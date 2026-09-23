/**
 * The contract every tender source implements.
 *
 * Sources vary wildly in reliability: one is a CSV drop, one is a JSON API, one
 * is blocked outright. The runner should not care, so each adapter either
 * returns rows in this shape or declares itself unavailable with a reason.
 */

/**
 * A tender as the source described it, before any scoring.
 *
 * `description` is the raw text from the source and is what gets sent for
 * scoring. It is not the same thing as `tenders_matched.summary`, which is the
 * short write-up the model produces per company.
 */
export type RawTender = {
  title: string
  /** Canonical public URL. Doubles as the deduplication key. */
  source_url: string
  /** ISO calendar date (YYYY-MM-DD) for the `date` column, or null if unknown. */
  deadline: string | null
  description: string
  procuring_entity: string
}

export type TenderSource = {
  /** Stable identifier, used in TENDER_SOURCES and in the run summary. */
  readonly id: string
  readonly label: string
  /**
   * Set when the source cannot be made to work without crossing a line we will
   * not cross (an auth wall, a blocked crawl, a failing certificate). A source
   * with a blockedReason is never called, and the reason is surfaced in the run
   * summary so it stays visible rather than looking like a silent zero.
   */
  readonly blockedReason?: string
  /** False when the source is present but not configured for this deployment. */
  isConfigured(): boolean
  /** Explains a false isConfigured() to whoever reads the run summary. */
  readonly configHint?: string
  fetchTenders(): Promise<RawTender[]>
}

/** What the runner records for one source on one run. */
export type SourceRunResult = {
  sourceId: string
  label: string
  status: 'fetched' | 'skipped' | 'blocked' | 'error'
  fetched: number
  /**
   * Rows the RUNNER rejected, meaning the adapter returned something that does
   * not satisfy the RawTender contract (no title, unusable URL, duplicate within
   * the batch). Non-zero here is a bug in that adapter, not bad upstream data.
   *
   * Rows an adapter drops internally, such as a malformed line in a CSV export,
   * are not counted here because fetchTenders returns only the good rows. Those
   * are warned about by the adapter itself so a bad export stays visible.
   */
  discarded: number
  detail?: string
}

const MAX_DESCRIPTION_LENGTH = 4000

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
}

/**
 * Turns a date as a source wrote it into an ISO calendar date.
 *
 * Handles the formats actually seen on Kenyan procurement pages: ISO,
 * ISO timestamps, day-first slash or dot separated dates, and dates with
 * named English months (e.g. '05-Oct-2026', 'October 6, 2026', '28 Sep 2026').
 */
export function parseDeadline(value: string | null | undefined): string | null {
  if (!value) return null

  const raw = value.trim()
  if (!raw) return null

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/)
  if (isoMatch) {
    return isValidYmd(isoMatch[1], isoMatch[2], isoMatch[3])
      ? `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
      : null
  }

  const dayFirst = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (dayFirst) {
    const day = dayFirst[1].padStart(2, '0')
    const month = dayFirst[2].padStart(2, '0')
    return isValidYmd(dayFirst[3], month, day)
      ? `${dayFirst[3]}-${month}-${day}`
      : null
  }

  // 05-Oct-2026, 28 Sep 2026, or 7th October, 2026
  const dayMonthYear = raw.match(/^(\d{1,2})(?:st|nd|rd|th)?[-/ ]+([a-z]+)[-,/ ]+(\d{4})$/i)
  if (dayMonthYear) {
    const month = MONTH_MAP[dayMonthYear[2].toLowerCase()]
    const day = dayMonthYear[1].padStart(2, '0')
    if (month && isValidYmd(dayMonthYear[3], month, day)) {
      return `${dayMonthYear[3]}-${month}-${day}`
    }
  }

  // October 6, 2026 or Oct 06 2026
  const monthDayYear = raw.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i)
  if (monthDayYear) {
    const month = MONTH_MAP[monthDayYear[1].toLowerCase()]
    const day = monthDayYear[2].padStart(2, '0')
    if (month && isValidYmd(monthDayYear[3], month, day)) {
      return `${monthDayYear[3]}-${month}-${day}`
    }
  }

  return null
}

function isValidYmd(year: string, month: string, day: string): boolean {
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)

  if (m < 1 || m > 12 || d < 1 || d > 31) return false

  // Round trip through Date to reject the likes of 2026-02-31.
  const probe = new Date(Date.UTC(y, m - 1, d))

  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  )
}

/** Only http(s) URLs are accepted, since the value is rendered as a link. */
export function normaliseSourceUrl(value: string | null | undefined): string | null {
  if (!value) return null

  try {
    const url = new URL(value.trim())

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

    return url.toString()
  } catch {
    return null
  }
}

/**
 * Cleans one row from a source. Returns null when the row is unusable, which is
 * counted rather than thrown, so one bad line cannot fail a whole fetch.
 */
export function normaliseTender(
  input: Partial<RawTender>,
  fallbackEntity: string,
): RawTender | null {
  const title = collapseWhitespace(input.title ?? '')
  const source_url = normaliseSourceUrl(input.source_url)

  // Without a title there is nothing to score, and without a URL there is no
  // deduplication key and nothing for a representative to open.
  if (!title || !source_url) return null

  const description = collapseWhitespace(input.description ?? '').slice(
    0,
    MAX_DESCRIPTION_LENGTH,
  )

  return {
    title,
    source_url,
    deadline: parseDeadline(input.deadline),
    description,
    procuring_entity:
      collapseWhitespace(input.procuring_entity ?? '') || fallbackEntity,
  }
}

/** Normalises a batch and drops duplicate source_urls within that batch. */
export function normaliseTenders(
  rows: Partial<RawTender>[],
  fallbackEntity: string,
): { tenders: RawTender[]; discarded: number } {
  const seen = new Set<string>()
  const tenders: RawTender[] = []
  let discarded = 0

  for (const row of rows) {
    const tender = normaliseTender(row, fallbackEntity)

    if (!tender) {
      discarded++
      continue
    }

    if (seen.has(tender.source_url)) {
      discarded++
      continue
    }

    seen.add(tender.source_url)
    tenders.push(tender)
  }

  return { tenders, discarded }
}

/** Strips HTML and decodes the entities WordPress returns in rendered fields. */
export function stripHtml(value: string): string {
  const withoutTags = value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')

  const decoded = withoutTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    // Ampersand last, so &amp;lt; does not become a tag delimiter.
    .replace(/&amp;/gi, '&')

  return collapseWhitespace(decoded)
}
