/**
 * PPIP, the Public Procurement Information Portal at tenders.go.ke.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A CSV IMPORT AND NOT A SCRAPER
 * ---------------------------------------------------------------------------
 *
 * robots.txt was checked first, on 26 August 2026. https://tenders.go.ke/robots.txt
 * returns:
 *
 *     User-agent: *
 *     Disallow:
 *
 * An empty Disallow blocks nothing, so crawling is permitted. Scraping was NOT
 * ruled out on robots grounds.
 *
 * It was ruled out on reliability grounds, which is the other half of the brief.
 * A plain HTTP GET of https://tenders.go.ke/ returns an application shell whose
 * entire text content is the string "PPIP". There are no tender rows, titles,
 * procuring entities or closing dates in the delivered HTML, and no RSS, JSON or
 * CSV export link. The listings are rendered client side from an XHR call.
 *
 * That leaves three options, and the least bad one is the third:
 *
 *   1. Ship a headless browser (Playwright) to execute the page scripts. Heavy
 *      for a cron job, and it still leaves us parsing markup that can change
 *      without notice, silently returning zero tenders.
 *   2. Reverse engineer the internal XHR endpoint the app calls. It is
 *      undocumented and unversioned, so it can change or start requiring a
 *      token at any time. Scoring a company against a feed that has quietly
 *      gone stale is worse than having no feed.
 *   3. Take a CSV export, which is what this adapter does.
 *
 * If PPIP publishes a documented API, or an OCDS release feed, replace the body
 * of fetchTenders with a client for it and delete this note. That is the right
 * long term answer; this is the honest interim one.
 *
 * ---------------------------------------------------------------------------
 * HOW TO USE IT
 * ---------------------------------------------------------------------------
 *
 * Export or assemble a CSV and put it where the job can read it:
 *
 *   - PPIP_CSV_PATH, a path on the deployment filesystem, or
 *   - PPIP_CSV_URL, an https URL the job fetches (a Supabase Storage signed URL
 *     works well, and keeps the file out of the repository).
 *
 * Expected header, in any column order, case insensitive:
 *
 *   title, source_url, deadline, description, procuring_entity
 *
 * Accepted aliases, because exports rarely match on the first try:
 *
 *   title            <- tender_title, tender name, subject
 *   source_url       <- url, link, tender_url
 *   deadline         <- closing_date, closing date, submission_deadline
 *   description      <- details, tender_description, scope
 *   procuring_entity <- entity, procuring entity, organisation, ministry
 *
 * Deadlines may be ISO (2026-09-30) or day first (30/09/2026).
 */

import { readFile } from 'node:fs/promises'

import {
  normaliseTenders,
  type RawTender,
  type TenderSource,
} from './types'

const FALLBACK_ENTITY = 'Unnamed procuring entity (PPIP)'

const COLUMN_ALIASES: Record<keyof RawTender, string[]> = {
  title: ['title', 'tender_title', 'tender title', 'tender name', 'subject'],
  source_url: ['source_url', 'source url', 'url', 'link', 'tender_url', 'tender url'],
  deadline: [
    'deadline',
    'closing_date',
    'closing date',
    'close_date',
    'submission_deadline',
    'submission deadline',
    'closing',
  ],
  description: [
    'description',
    'details',
    'tender_description',
    'tender description',
    'scope',
    'summary',
  ],
  procuring_entity: [
    'procuring_entity',
    'procuring entity',
    'entity',
    'organisation',
    'organization',
    'ministry',
    'department',
  ],
}

/**
 * Minimal RFC 4180 parser: quoted fields, embedded commas and newlines, and ""
 * as an escaped quote. Written out rather than pulled from a dependency because
 * that is the whole of the format we need.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  // Normalise newlines so CRLF exports parse the same as LF ones.
  const text = input.replace(/\r\n?/g, '\n')

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  // Trailing field, unless the file ended on a newline.
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Drop blank lines, including a trailing newline at end of file.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
}

function headerIndex(header: string[]): Partial<Record<keyof RawTender, number>> {
  const normalised = header.map((cell) => cell.trim().toLowerCase())
  const mapping: Partial<Record<keyof RawTender, number>> = {}

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [
    keyof RawTender,
    string[],
  ][]) {
    const index = normalised.findIndex((cell) => aliases.includes(cell))
    if (index !== -1) mapping[field] = index
  }

  return mapping
}

export function tendersFromCsv(csv: string): {
  tenders: RawTender[]
  discarded: number
} {
  const rows = parseCsv(csv)

  if (rows.length === 0) return { tenders: [], discarded: 0 }

  const [header, ...body] = rows
  const index = headerIndex(header)

  // Without these two there is nothing to score and no deduplication key, so a
  // mislabelled export should fail loudly instead of importing zero rows.
  if (index.title === undefined || index.source_url === undefined) {
    throw new Error(
      'PPIP CSV needs at least a title column and a source_url column. ' +
        `Found: ${header.map((cell) => cell.trim()).join(', ') || '(no header)'}`,
    )
  }

  const cell = (row: string[], field: keyof RawTender): string | undefined => {
    const at = index[field]
    return at === undefined ? undefined : row[at]
  }

  return normaliseTenders(
    body.map((row) => ({
      title: cell(row, 'title'),
      source_url: cell(row, 'source_url'),
      deadline: cell(row, 'deadline') ?? null,
      description: cell(row, 'description'),
      procuring_entity: cell(row, 'procuring_entity'),
    })),
    FALLBACK_ENTITY,
  )
}

async function loadCsv(): Promise<string> {
  const path = process.env.PPIP_CSV_PATH?.trim()
  const url = process.env.PPIP_CSV_URL?.trim()

  if (path) return await readFile(path, 'utf8')

  if (url) {
    const response = await fetch(url, {
      headers: { accept: 'text/csv, text/plain' },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`PPIP CSV fetch failed with HTTP ${response.status}`)
    }

    return await response.text()
  }

  // isConfigured() gates this, so reaching here is a programming error.
  throw new Error('PPIP CSV source is not configured')
}

export const ppipSource: TenderSource = {
  id: 'ppip',
  label: 'PPIP (tenders.go.ke) CSV import',

  isConfigured() {
    return Boolean(
      process.env.PPIP_CSV_PATH?.trim() || process.env.PPIP_CSV_URL?.trim(),
    )
  },

  configHint:
    'Set PPIP_CSV_PATH or PPIP_CSV_URL to a CSV export. tenders.go.ke renders ' +
    'its listings client side, so there is no reliable page to parse. See the ' +
    'note at the top of lib/tender-sources/ppip.ts.',

  async fetchTenders() {
    const { tenders, discarded } = tendersFromCsv(await loadCsv())

    // fetchTenders returns only usable rows, so a silently shrinking import
    // would otherwise look like a shrinking tender list. Say it out loud.
    if (discarded > 0) {
      console.warn(
        `[tender-sources] ppip: ${discarded} CSV row(s) were unusable and were ` +
          'skipped (missing title, missing or non-http source_url, or a ' +
          'source_url repeated within the file)',
      )
    }

    return tenders
  },
}
