/**
 * Deterministic stand-in for the LLM, for driving the pipeline with no provider
 * credits.
 *
 * WHAT THIS IS FOR
 *
 * Everything in the pipeline except the two model calls is real work worth
 * verifying: fetching sources, writing matches, building .docx bytes, uploading to
 * private Storage, sending the email, rendering the dashboard. When the provider
 * is unreachable — an unpaid xAI team, a missing Groq key — none of it can be
 * exercised, because the run dies at the first call. This client fills that one
 * gap so the other eight stages can be tested end to end.
 *
 * WHAT IT IS NOT
 *
 * Not a model, and not a fallback. It is never wired into the app: only
 * scripts/verify-pipeline.mts passes it in, only when asked with --stub-ai, and
 * every document and summary it produces is stamped so its output can never be
 * mistaken for a real draft. Scores it produces are keyword overlap, not judgement.
 */

import type { AiClient } from '@/lib/ai'

export const STUB_MODEL = 'stub-ai (deterministic, not a language model)'

/** Marker written into every drafted section, so stub output is self-identifying. */
export const STUB_NOTICE =
  'PLACEHOLDER CONTENT: produced by the offline verification stub, not by a ' +
  'language model. It exists to prove the drafting, storage and email stages ' +
  'work. Re-run without --stub-ai once an AI provider is configured.'

type ParsedTender = { ref: number; title: string; description: string }

/** Pulls the tender blocks back out of the scoring prompt. */
function parseTenders(prompt: string): ParsedTender[] {
  const tenders: ParsedTender[] = []
  const blocks = prompt.matchAll(/<tender ref="(\d+)">([\s\S]*?)<\/tender>/g)

  for (const [, ref, body] of blocks) {
    tenders.push({
      ref: Number(ref),
      title: body.match(/^Title: (.*)$/m)?.[1] ?? '',
      description: body.match(/^Description: (.*)$/m)?.[1] ?? '',
    })
  }

  return tenders
}

/** Pulls the company's industry and sectors back out of the prompt. */
function parseProfile(prompt: string): string[] {
  const industry = prompt.match(/^Industry: (.*)$/m)?.[1] ?? ''
  const sectors = prompt.match(/^Sectors of interest: (.*)$/m)?.[1] ?? ''

  return terms(`${industry} ${sectors}`)
}

const STOP_WORDS = new Set([
  'and',
  'the',
  'of',
  'for',
  'not',
  'stated',
  'services',
  'service',
  'other',
  'supply',
  'county',
  'provision',
])

function terms(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
}

/**
 * Keyword overlap between the profile and the tender text, mapped onto 0-100.
 *
 * Crude on purpose: it has to be explainable in one sentence and produce the same
 * answer every run. Absolute hit count rather than a ratio, because a profile with
 * many terms would otherwise dilute every score below the threshold and nothing
 * would ever match. Five or more shared terms is treated as a strong signal.
 *
 * It does discriminate — an ICT profile scores the cloud infrastructure and
 * server fixtures well above the pharmaceutical and road ones — which is enough
 * to see matching, insertion and thresholding behave.
 */
function overlapScore(profile: string[], tender: ParsedTender): number {
  const haystack = new Set(terms(`${tender.title} ${tender.description}`))

  if (profile.length === 0 || haystack.size === 0) return 0

  const hits = new Set(profile.filter((word) => haystack.has(word))).size

  // 0 hits -> 20, so nothing lands at a suspiciously round zero; 5 or more clears
  // the default threshold of 60 comfortably.
  return Math.min(100, Math.round(20 + Math.min(1, hits / 5) * 75))
}

function scoreResponse(prompt: string): unknown {
  const profile = parseProfile(prompt)

  return {
    scores: parseTenders(prompt).map((tender) => {
      const score = overlapScore(profile, tender)
      const haystack = new Set(terms(`${tender.title} ${tender.description}`))
      const hits = [...new Set(profile.filter((word) => haystack.has(word)))]

      return {
        ref: tender.ref,
        match_score: score,
        summary:
          `[STUB SCORE, keyword overlap only] ${hits.length} profile term(s) ` +
          `matched${hits.length > 0 ? `: ${hits.slice(0, 6).join(', ')}` : ''}. ` +
          'Not a judgement of fit.',
      }
    }),
  }
}

function coverLetterResponse(): unknown {
  return {
    title: 'Cover letter (verification stub)',
    sections: [
      {
        heading: 'About this document',
        paragraphs: [STUB_NOTICE],
        bullets: [],
      },
      {
        heading: 'Addressee',
        paragraphs: [],
        bullets: [
          '[INSERT: procuring entity name and postal address]',
          '[INSERT: tender reference number as printed on the notice]',
        ],
      },
      {
        heading: 'Introduction',
        paragraphs: [
          'We submit our bid for the tender named above and confirm that the ' +
            'required documents are enclosed.',
        ],
        bullets: [],
      },
      {
        heading: 'Evidence to attach',
        paragraphs: [],
        bullets: [
          '[INSERT: certificate of incorporation]',
          '[INSERT: valid tax compliance certificate]',
          '[INSERT: two comparable completed works, with client and value]',
          '[INSERT: statutory registration relevant to this category and its number]',
        ],
      },
      {
        heading: 'Signature',
        paragraphs: [],
        bullets: ['[INSERT: authorised signatory name, title, date and company stamp]'],
      },
    ],
  }
}

function technicalProposalResponse(): unknown {
  const headings = [
    'Understanding of the requirement',
    'Proposed approach and methodology',
    'Work programme',
    'Team and roles',
    'Plant and equipment',
    'Quality and safety',
    'Relevant experience',
    'Compliance with the eligibility criteria',
  ]

  return {
    title: 'Technical proposal skeleton (verification stub)',
    sections: [
      { heading: 'About this document', paragraphs: [STUB_NOTICE], bullets: [] },
      ...headings.map((heading) => ({
        heading,
        paragraphs: [],
        bullets: [
          `[INSERT: ${heading.toLowerCase()} — what the notice asks for here]`,
          '[INSERT: the evidence you will attach for this section]',
        ],
      })),
    ],
  }
}

/**
 * An AiClient that answers from the prompt shape rather than a network call.
 *
 * Which of the three prompts it is answering is decided by the system prompt,
 * whose opening line is stable in lib/tender-matching.ts and
 * lib/tender-drafting.ts. An unrecognised prompt throws rather than returning
 * something plausible, so a prompt change surfaces here instead of silently
 * producing junk.
 */
export function createStubAiClient(): AiClient {
  return {
    provider: 'groq',
    model: STUB_MODEL,

    async completeJson(system: string, prompt: string): Promise<unknown> {
      if (system.startsWith('You score public procurement tenders')) {
        return scoreResponse(prompt)
      }

      if (system.startsWith('Draft a cover letter')) return coverLetterResponse()

      if (system.startsWith('Draft a technical proposal SKELETON')) {
        return technicalProposalResponse()
      }

      throw new Error(
        'stub-ai does not recognise this prompt. Its opening line changed in ' +
          'lib/tender-matching.ts or lib/tender-drafting.ts; update ' +
          `scripts/stub-ai.mts to match. Prompt began: ${system.slice(0, 80)}`,
      )
    },
  }
}
