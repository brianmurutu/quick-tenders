/**
 * Relevance scoring, via the xAI Grok API.
 *
 * One call handles one company against a batch of tenders, rather than one call
 * per tender. A company profile is the expensive part of the prompt and it is
 * identical across its tenders, so batching cuts both cost and wall clock by
 * roughly the batch size. Batches are capped because output quality falls off
 * when a model is asked for too many structured items at once.
 *
 * Grok is asked for JSON-only output, then its response is fully validated.
 */

import type { RawTender } from '@/lib/tender-sources'
import { createGrokClient, grokModel, type GrokClient } from '@/lib/grok'

export const DEFAULT_MODEL = 'grok-4.6'
export const DEFAULT_THRESHOLD = 60
export const MAX_BATCH_SIZE = 20
export const MAX_SUMMARY_LENGTH = 400

export type ScoringCompany = {
  id: string
  name: string | null
  industry: string | null
  sectors_of_interest: string[] | null
  region: string | null
  company_size: string | null
}

export type TenderScore = {
  tender: RawTender
  match_score: number
  summary: string
}

const SYSTEM_PROMPT = [
  'You score public procurement tenders for relevance to one company.',
  '',
  'Judge relevance on:',
  '  - whether the work falls in the sectors the company says it wants,',
  '  - whether it is consistent with their stated industry,',
  '  - proximity to their county, treating a nearby or nationwide contract as',
  '    workable and a distant county as a real cost,',
  '  - whether the contract size is plausible for a company of their headcount.',
  '',
  'Be discriminating. A score above 80 should mean a company would be annoyed to',
  'have missed it. Below 30 should mean it is not their line of work at all.',
  'Do not inflate scores to be encouraging, and do not invent requirements the',
  'tender text does not state. If the text is too thin to judge, score it low and',
  'say the description was thin.',
].join('\n')

function describeCompany(company: ScoringCompany): string {
  const sectors = company.sectors_of_interest?.length
    ? company.sectors_of_interest.join(', ')
    : 'not stated'

  return [
    `Company: ${company.name ?? 'not stated'}`,
    `Industry: ${company.industry ?? 'not stated'}`,
    `Sectors of interest: ${sectors}`,
    `Based in: ${company.region ?? 'not stated'} county`,
    `Headcount band: ${company.company_size ?? 'not stated'}`,
  ].join('\n')
}

function describeTenders(tenders: RawTender[]): string {
  return tenders
    .map((tender, index) =>
      [
        `<tender ref="${index}">`,
        `Title: ${tender.title}`,
        `Procuring entity: ${tender.procuring_entity}`,
        `Closing date: ${tender.deadline ?? 'not stated'}`,
        `Description: ${tender.description || 'not provided'}`,
        '</tender>',
      ].join('\n'),
    )
    .join('\n\n')
}

export function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []

  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }

  return batches
}

type RawScore = { ref: number; match_score: number; summary: string }

/**
 * Validates what came back from the tool call.
 *
 * Model output is input like any other: refs outside the batch are dropped,
 * scores are clamped into range, non-integers and missing summaries are
 * rejected, and a duplicate ref keeps the first mention. A tender the model
 * simply did not score is left out entirely rather than defaulted to zero, so it
 * can be retried on the next run instead of being recorded as irrelevant.
 */
export function parseScores(input: unknown, batch: RawTender[]): TenderScore[] {
  if (!input || typeof input !== 'object') return []

  const scores = (input as { scores?: unknown }).scores

  if (!Array.isArray(scores)) return []

  const seen = new Set<number>()
  const parsed: TenderScore[] = []

  for (const entry of scores as Partial<RawScore>[] ) {
    if (!entry || typeof entry !== 'object') continue

    const { ref, match_score, summary } = entry

    if (typeof ref !== 'number' || !Number.isInteger(ref)) continue
    if (ref < 0 || ref >= batch.length) continue
    if (seen.has(ref)) continue
    if (typeof match_score !== 'number' || Number.isNaN(match_score)) continue
    if (typeof summary !== 'string' || summary.trim() === '') continue

    seen.add(ref)

    parsed.push({
      tender: batch[ref],
      match_score: Math.max(0, Math.min(100, Math.round(match_score))),
      summary: summary.trim().slice(0, MAX_SUMMARY_LENGTH),
    })
  }

  return parsed
}

export function scoringModel(): string {
  return grokModel()
}

export function matchThreshold(): number {
  const raw = process.env.TENDER_MATCH_THRESHOLD?.trim()

  if (!raw) return DEFAULT_THRESHOLD

  const parsed = Number(raw)

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return DEFAULT_THRESHOLD
  }

  return parsed
}

/** Scores one batch. Throws on API failure so the caller can decide. */
export async function scoreBatch(
  client: GrokClient,
  company: ScoringCompany,
  batch: RawTender[],
): Promise<TenderScore[]> {
  const response = await client.completeJson(
    SYSTEM_PROMPT,
    [
          'Score these tenders for the following company.',
          '',
          describeCompany(company),
          '',
          `Tenders (${batch.length}):`,
          '',
          describeTenders(batch),
          '',
          `Return only a JSON object: {"scores":[{"ref":0,"match_score":0,"summary":"..."}]}. Include exactly ${batch.length} entries.`,
    ].join('\n'),
  )
  return parseScores(response, batch)
}

export { createGrokClient }

/**
 * Scores every tender for one company, batch by batch.
 *
 * Batches run sequentially rather than in parallel: a company with 200 tenders
 * would otherwise open ten concurrent requests per company and trip rate limits
 * once there are more than a handful of companies. A failing batch is reported
 * and the rest continue.
 */
export async function scoreTendersForCompany(
  client: GrokClient,
  company: ScoringCompany,
  tenders: RawTender[],
): Promise<{ scores: TenderScore[]; errors: string[] }> {
  const scores: TenderScore[] = []
  const errors: string[] = []

  for (const batch of chunk(tenders, MAX_BATCH_SIZE)) {
    try {
      scores.push(...(await scoreBatch(client, company, batch)))
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  return { scores, errors }
}
