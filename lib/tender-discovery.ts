/**
 * The discovery run: fetch from every enabled source, score per company, insert
 * what clears the threshold, and return a summary.
 *
 * Kept separate from the route handler so it can be driven from a script or a
 * test without an HTTP request.
 */

import {
  createGrokClient,
  matchThreshold,
  scoreTendersForCompany,
  scoringModel,
  type ScoringCompany,
} from '@/lib/tender-matching'
import {
  dropExpired,
  enabledSourceIds,
  fetchAllTenders,
  type RawTender,
  type SourceRunResult,
} from '@/lib/tender-sources'
import { createAdminClient, type SupabaseAdminClient } from '@/lib/supabase/admin'

export type CompanyRunResult = {
  companyId: string
  companyName: string | null
  /** How many tenders were scored for this company after the profile filter. */
  scored: number
  aboveThreshold: number
  /** Rows actually written. Lower than aboveThreshold when some already existed. */
  inserted: number
  skippedExisting: number
  topScore: number | null
  errors: string[]
}

export type DiscoveryRunSummary = {
  startedAt: string
  finishedAt: string
  durationMs: number
  model: string
  threshold: number
  sourcesRequested: string[]
  sources: SourceRunResult[]
  tendersFetched: number
  tendersAfterExpiryFilter: number
  companiesConsidered: number
  companiesSkipped: { companyId: string; companyName: string | null; reason: string }[]
  companies: CompanyRunResult[]
  totals: { scored: number; inserted: number; skippedExisting: number }
  errors: string[]
}

/**
 * A company with no profile is skipped rather than scored against a blank
 * profile, which would spend tokens to produce noise. They land here until they
 * finish /onboarding.
 */
function profileIsUsable(company: ScoringCompany): boolean {
  return Boolean(
    company.industry?.trim() ||
      (company.sectors_of_interest && company.sectors_of_interest.length > 0),
  )
}

async function loadCompanies(supabase: SupabaseAdminClient): Promise<ScoringCompany[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, industry, sectors_of_interest, region, company_size')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Could not load companies: ${error.message}`)
  }

  return data ?? []
}

/**
 * The source_urls this company already has, so scoring output can be filtered
 * before insert.
 *
 * The unique index from migration 0005 is the real guarantee; this read is what
 * makes the run report honestly on how many rows were genuinely new, and avoids
 * sending pointless writes.
 */
async function existingSourceUrls(
  supabase: SupabaseAdminClient,
  companyId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('tenders_matched')
    .select('source_url')
    .eq('company_id', companyId)

  if (error) {
    throw new Error(`Could not read existing tenders: ${error.message}`)
  }

  return new Set(
    (data ?? [])
      .map((row) => row.source_url)
      .filter((url): url is string => typeof url === 'string'),
  )
}

export type RunOptions = {
  /** Skip the Grok and database work, to check source health only. */
  dryRun?: boolean
  /** Overrides TENDER_SOURCES for one run. */
  sourceIds?: string[]
}

export async function runDiscovery(
  options: RunOptions = {},
): Promise<DiscoveryRunSummary> {
  const startedAt = new Date()
  const requested = options.sourceIds ?? enabledSourceIds()
  const threshold = matchThreshold()
  const errors: string[] = []

  const { tenders: fetched, sources } = await fetchAllTenders(undefined, requested)
  const tenders = dropExpired(fetched)

  const companies: CompanyRunResult[] = []
  const companiesSkipped: DiscoveryRunSummary['companiesSkipped'] = []
  let considered = 0

  if (!options.dryRun && tenders.length > 0) {
    let supabase: SupabaseAdminClient
    let grok: ReturnType<typeof createGrokClient>

    try {
      supabase = createAdminClient()
      grok = createGrokClient()
    } catch (error) {
      // Missing configuration is fatal for the scoring half, but the source
      // summary above is still worth returning.
      errors.push(error instanceof Error ? error.message : String(error))

      return summarise({
        startedAt,
        threshold,
        requested,
        sources,
        fetched: fetched.length,
        afterExpiry: tenders.length,
        considered,
        companiesSkipped,
        companies,
        errors,
      })
    }

    let allCompanies: ScoringCompany[] = []

    try {
      allCompanies = await loadCompanies(supabase)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }

    for (const company of allCompanies) {
      if (!profileIsUsable(company)) {
        companiesSkipped.push({
          companyId: company.id,
          companyName: company.name,
          reason: 'No industry or sectors_of_interest yet, so onboarding is unfinished',
        })
        continue
      }

      considered++
      companies.push(await runForCompany(supabase, grok, company, tenders, threshold))
    }
  }

  return summarise({
    startedAt,
    threshold,
    requested,
    sources,
    fetched: fetched.length,
    afterExpiry: tenders.length,
    considered,
    companiesSkipped,
    companies,
    errors,
  })
}

async function runForCompany(
  supabase: SupabaseAdminClient,
  grok: ReturnType<typeof createGrokClient>,
  company: ScoringCompany,
  tenders: RawTender[],
  threshold: number,
): Promise<CompanyRunResult> {
  const result: CompanyRunResult = {
    companyId: company.id,
    companyName: company.name,
    scored: 0,
    aboveThreshold: 0,
    inserted: 0,
    skippedExisting: 0,
    topScore: null,
    errors: [],
  }

  let existing: Set<string>

  try {
    existing = await existingSourceUrls(supabase, company.id)
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error))

    return result
  }

  // Do not pay to score a tender this company already has.
  const unseen = tenders.filter((tender) => !existing.has(tender.source_url))
  result.skippedExisting = tenders.length - unseen.length

  if (unseen.length === 0) return result

  const { scores, errors } = await scoreTendersForCompany(grok, company, unseen)
  result.errors.push(...errors)
  result.scored = scores.length

  if (scores.length > 0) {
    result.topScore = Math.max(...scores.map((score) => score.match_score))
  }

  const matches = scores.filter((score) => score.match_score >= threshold)
  result.aboveThreshold = matches.length

  if (matches.length === 0) return result

  // onConflict names the unique index from 0005, and ignoreDuplicates makes a
  // re-run a no-op rather than an error. The index is what actually enforces
  // this; the earlier read is only an optimisation.
  const { data, error } = await supabase
    .from('tenders_matched')
    .upsert(
      matches.map((match) => ({
        company_id: company.id,
        title: match.tender.title,
        source_url: match.tender.source_url,
        deadline: match.tender.deadline,
        summary: match.summary,
        match_score: match.match_score,
        procuring_entity: match.tender.procuring_entity,
        status: 'new' as const,
      })),
      { onConflict: 'company_id,source_url', ignoreDuplicates: true },
    )
    .select('id')

  if (error) {
    result.errors.push(`Insert failed: ${error.message}`)

    return result
  }

  result.inserted = data?.length ?? 0

  return result
}

function summarise(input: {
  startedAt: Date
  threshold: number
  requested: string[]
  sources: SourceRunResult[]
  fetched: number
  afterExpiry: number
  considered: number
  companiesSkipped: DiscoveryRunSummary['companiesSkipped']
  companies: CompanyRunResult[]
  errors: string[]
}): DiscoveryRunSummary {
  const finishedAt = new Date()

  return {
    startedAt: input.startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - input.startedAt.getTime(),
    model: scoringModel(),
    threshold: input.threshold,
    sourcesRequested: input.requested,
    sources: input.sources,
    tendersFetched: input.fetched,
    tendersAfterExpiryFilter: input.afterExpiry,
    companiesConsidered: input.considered,
    companiesSkipped: input.companiesSkipped,
    companies: input.companies,
    totals: {
      scored: input.companies.reduce((sum, company) => sum + company.scored, 0),
      inserted: input.companies.reduce((sum, company) => sum + company.inserted, 0),
      skippedExisting: input.companies.reduce(
        (sum, company) => sum + company.skippedExisting,
        0,
      ),
    },
    errors: input.errors,
  }
}

/**
 * Human readable run log, per source and per company as the brief asks.
 * Written to stdout, where a platform log drain will pick it up.
 */
export function formatRunSummary(summary: DiscoveryRunSummary): string {
  const lines: string[] = []

  lines.push(
    `[discover-tenders] run finished in ${summary.durationMs}ms ` +
      `(model ${summary.model}, threshold ${summary.threshold})`,
  )

  lines.push(`[discover-tenders] sources (${summary.sources.length}):`)
  for (const source of summary.sources) {
    const detail = source.detail ? ` (${source.detail})` : ''
    lines.push(
      `  - ${source.label} [${source.sourceId}]: ${source.status}, ` +
        `${source.fetched} fetched, ${source.discarded} discarded${detail}`,
    )
  }

  lines.push(
    `[discover-tenders] ${summary.tendersFetched} tenders fetched, ` +
      `${summary.tendersAfterExpiryFilter} still open`,
  )

  lines.push(`[discover-tenders] companies (${summary.companies.length}):`)
  for (const company of summary.companies) {
    const name = company.companyName ?? company.companyId
    const top = company.topScore === null ? 'n/a' : String(company.topScore)
    lines.push(
      `  - ${name}: ${company.scored} scored, ${company.aboveThreshold} above ` +
        `threshold, ${company.inserted} inserted, ${company.skippedExisting} ` +
        `already held, top score ${top}`,
    )
    for (const error of company.errors) {
      lines.push(`      error: ${error}`)
    }
  }

  for (const skipped of summary.companiesSkipped) {
    lines.push(
      `  - ${skipped.companyName ?? skipped.companyId}: skipped, ${skipped.reason}`,
    )
  }

  lines.push(
    `[discover-tenders] totals: ${summary.totals.scored} scored, ` +
      `${summary.totals.inserted} inserted, ` +
      `${summary.totals.skippedExisting} already held`,
  )

  for (const error of summary.errors) {
    lines.push(`[discover-tenders] error: ${error}`)
  }

  return lines.join('\n')
}
