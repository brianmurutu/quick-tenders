/**
 * The source registry and the fetch half of the discovery run.
 *
 * Adding a source means writing one file and adding one line to ALL_SOURCES.
 * Nothing else in the pipeline needs to know it exists.
 */

import { countySources } from './county'
import { mockSource } from './mock'
import { ppipSource } from './ppip'
import {
  normaliseSourceUrl,
  normaliseTenders,
  type RawTender,
  type SourceRunResult,
  type TenderSource,
} from './types'

export * from './types'
export { ppipSource } from './ppip'
export { mockSource } from './mock'
export {
  countySources,
  makeWordPressCountySource,
  nairobiCountySource,
  kiambuCountySource,
  nakuruCountySource,
} from './county'

export const ALL_SOURCES: TenderSource[] = [ppipSource, ...countySources, mockSource]

/**
 * Which sources this deployment runs, from TENDER_SOURCES as a comma separated
 * list of ids. Unset means every real source, and mock only outside production,
 * so a development machine works immediately while a deployment has to opt in
 * to fixtures on purpose.
 */
export function enabledSourceIds(): string[] {
  const configured = process.env.TENDER_SOURCES?.trim()

  if (configured) {
    return configured
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  }

  return ALL_SOURCES.filter(
    (source) => source.id !== 'mock' || process.env.NODE_ENV !== 'production',
  ).map((source) => source.id)
}

export type FetchAllResult = {
  tenders: RawTender[]
  sources: SourceRunResult[]
}

/**
 * Runs every selected source and merges the results.
 *
 * Three properties matter here:
 *
 *   - One source failing never fails the run. A timeout on a county portal must
 *     not stop PPIP tenders reaching the companies waiting on them.
 *   - Every source appears in the summary with a status, so a blocked or
 *     unconfigured source is visible rather than looking like a quiet zero.
 *   - Duplicates across sources collapse on source_url, keeping whichever copy
 *     arrived first. Two portals listing the same notice is normal.
 */
export async function fetchAllTenders(
  sources: TenderSource[] = ALL_SOURCES,
  selectedIds: string[] = enabledSourceIds(),
): Promise<FetchAllResult> {
  const selected = new Set(selectedIds)
  const results: SourceRunResult[] = []

  const unknown = selectedIds.filter(
    (id) => !sources.some((source) => source.id === id),
  )

  for (const id of unknown) {
    results.push({
      sourceId: id,
      label: id,
      status: 'error',
      fetched: 0,
      discarded: 0,
      detail: 'Named in TENDER_SOURCES but no adapter with that id exists',
    })
  }

  const settled = await Promise.all(
    sources.map(async (source): Promise<{ result: SourceRunResult; tenders: RawTender[] }> => {
      const base = { sourceId: source.id, label: source.label, fetched: 0, discarded: 0 }

      if (!selected.has(source.id)) {
        return {
          result: { ...base, status: 'skipped', detail: 'Not in TENDER_SOURCES' },
          tenders: [],
        }
      }

      if (source.blockedReason) {
        return {
          result: { ...base, status: 'blocked', detail: source.blockedReason },
          tenders: [],
        }
      }

      if (!source.isConfigured()) {
        return {
          result: {
            ...base,
            status: 'skipped',
            detail: source.configHint ?? 'Not configured',
          },
          tenders: [],
        }
      }

      try {
        // Re-normalise what the adapter returned rather than trusting it. The
        // interface is a contract other people will implement, and a source that
        // returns a row with no URL or an unusable protocol must not be able to
        // push it into the pipeline.
        const returned = await source.fetchTenders()
        const { tenders, discarded } = normaliseTenders(returned, source.label)

        if (discarded > 0) {
          console.warn(
            `[tender-sources] ${source.id} returned ${discarded} row(s) that do ` +
              'not satisfy the RawTender contract; they were dropped',
          )
        }

        return {
          result: { ...base, status: 'fetched', fetched: tenders.length, discarded },
          tenders,
        }
      } catch (error) {
        return {
          result: {
            ...base,
            status: 'error',
            detail: error instanceof Error ? error.message : String(error),
          },
          tenders: [],
        }
      }
    }),
  )

  const seen = new Set<string>()
  const tenders: RawTender[] = []

  for (const { result, tenders: fromSource } of settled) {
    let duplicates = 0

    for (const tender of fromSource) {
      const key = normaliseSourceUrl(tender.source_url) ?? tender.source_url

      if (seen.has(key)) {
        duplicates++
        continue
      }

      seen.add(key)
      tenders.push(tender)
    }

    results.push(
      duplicates > 0
        ? {
            ...result,
            detail: [result.detail, `${duplicates} already seen from another source`]
              .filter(Boolean)
              .join('; '),
          }
        : result,
    )
  }

  return { tenders, sources: results }
}

/** Drops tenders whose deadline has already passed. Null deadlines are kept. */
export function dropExpired(tenders: RawTender[], now: Date = new Date()): RawTender[] {
  const today = now.toISOString().slice(0, 10)

  return tenders.filter((tender) => tender.deadline === null || tender.deadline >= today)
}
