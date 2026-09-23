/**
 * Government Advertising Agency (gaa.go.ke).
 *
 * ---------------------------------------------------------------------------
 * CRAWL POLICY & ACCESS CHECK
 * ---------------------------------------------------------------------------
 *
 * robots.txt was checked on 23 September 2026. https://gaa.go.ke/robots.txt
 * permits public crawling of /all-tenders (standard Drupal robots configuration).
 *
 * GAA aggregates procurement announcements for government ministries, departments,
 * and state agencies across Kenya, providing direct PDF download links.
 */

import {
  normaliseTenders,
  parseDeadline,
  stripHtml,
  type RawTender,
  type TenderSource,
} from './types'

const SOURCE_URL = 'https://gaa.go.ke/all-tenders'
const ORIGIN = 'https://gaa.go.ke'
const FETCH_TIMEOUT_MS = 25_000
const FALLBACK_ENTITY = 'Government Advertising Agency (GAA)'
const MAX_ROWS = 100

export function parseGaaHtml(html: string): RawTender[] {
  const tenders: RawTender[] = []
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const rows = html.match(rowRegex) || []

  // Skip the header row
  for (const row of rows.slice(1, MAX_ROWS + 1)) {
    const titleMatch = row.match(/class="[^"]*views-field-title[^"]*"[^>]*>([\s\S]*?)<\/td>/i)
    if (!titleMatch) continue

    const title = stripHtml(titleMatch[1].trim())
    if (!title) continue

    const entityMatch = row.match(/class="[^"]*views-field-field-ten[^"]*"[^>]*>([\s\S]*?)<\/td>/i)
    const procuring_entity = entityMatch ? stripHtml(entityMatch[1].trim()) || FALLBACK_ENTITY : FALLBACK_ENTITY

    const dateMatch = row.match(/class="[^"]*views-field-field-tender-closing-date[^"]*"[^>]*>([\s\S]*?)<\/td>/i)
    const deadlineRaw = dateMatch ? stripHtml(dateMatch[1].trim()) : null
    const deadline = parseDeadline(deadlineRaw)

    const docMatch = row.match(/href="([^"]+)"/i)
    let source_url = docMatch ? docMatch[1].trim() : ''

    if (source_url && !source_url.startsWith('http')) {
      source_url = `${ORIGIN}${source_url.startsWith('/') ? '' : '/'}${source_url}`
    }

    if (!source_url) {
      // Fallback anchor link if no direct document attachment was uploaded
      source_url = `${SOURCE_URL}#tender-${encodeURIComponent(title.slice(0, 30))}`
    }

    const description = [
      title,
      `Procuring Entity: ${procuring_entity}`,
      deadlineRaw ? `Closing Date: ${deadlineRaw}` : '',
      `Published by Government Advertising Agency`,
    ]
      .filter(Boolean)
      .join('. ')

    tenders.push({
      title,
      source_url,
      deadline,
      description,
      procuring_entity,
    })
  }

  const { tenders: normalised } = normaliseTenders(tenders, FALLBACK_ENTITY)
  return normalised
}

export const gaaSource: TenderSource = {
  id: 'gaa',
  label: 'Government Advertising Agency (gaa.go.ke)',

  isConfigured() {
    return true
  },

  configHint: 'Fetches public tenders directly from gaa.go.ke/all-tenders.',

  async fetchTenders(): Promise<RawTender[]> {
    const response = await fetch(SOURCE_URL, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'user-agent': 'QuickTender-Bot/1.0 (+https://quicktenders.co.ke)',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`gaa.go.ke returned HTTP ${response.status}`)
    }

    const html = await response.text()
    return parseGaaHtml(html)
  },
}
