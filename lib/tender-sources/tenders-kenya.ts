/**
 * Tenders Kenya (tenderskenya.co.ke).
 *
 * ---------------------------------------------------------------------------
 * CRAWL POLICY & ACCESS CHECK
 * ---------------------------------------------------------------------------
 *
 * robots.txt was checked on 23 September 2026. https://www.tenderskenya.co.ke/robots.txt returns:
 *
 *     User-agent: *
 *     Disallow: /login
 *     Sitemap: https://www.tenderskenya.co.ke/sitemap.xml
 *
 * Public tender cards are permitted for indexing and retrieval.
 */

import {
  normaliseTenders,
  parseDeadline,
  stripHtml,
  type RawTender,
  type TenderSource,
} from './types'

const SOURCE_URL = 'https://www.tenderskenya.co.ke'
const FETCH_TIMEOUT_MS = 15_000
const FALLBACK_ENTITY = 'Tenders Kenya'

/**
 * Parses tenderbox HTML cards from the server-rendered page.
 */
export function parseTendersKenyaHtml(html: string): RawTender[] {
  const tenders: RawTender[] = []
  // Matches each tender card block
  const cardRegex = /<div class="[^"]*tenderbox[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi
  const cards = html.match(cardRegex) || []

  for (const card of cards) {
    // Extract title & link
    const linkMatch = card.match(/<a class="tenderbox_title[^"]*" href="([^"]+)">[\s\S]*?<h5[^>]*>([\s\S]*?)<\/h5>/i)
    if (!linkMatch) continue

    const source_url = linkMatch[1].trim()
    const title = stripHtml(linkMatch[2].trim())

    if (!title || !source_url) continue

    // Extract procuring entity
    const entityMatch = card.match(/typcn-home-outline[\s\S]*?<span class="text-orange-1">([\s\S]*?)<\/span>/i)
    const procuring_entity = entityMatch ? stripHtml(entityMatch[1].trim()) : FALLBACK_ENTITY

    // Extract category as part of description
    const catMatch = card.match(/typcn-link[\s\S]*?<span class="text-orange-1">([\s\S]*?)<\/span>/i)
    const category = catMatch ? stripHtml(catMatch[1].trim()) : ''

    // Extract closing deadline
    const deadlineMatch = card.match(/Close:\s*<span[^>]*>([\s\S]*?)<\/span>/i)
    const deadlineStr = deadlineMatch ? stripHtml(deadlineMatch[1].trim()) : null
    const deadline = parseDeadline(deadlineStr)

    const description = [title, category ? `Category: ${category}` : '', `Procuring Entity: ${procuring_entity}`]
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

export const tendersKenyaSource: TenderSource = {
  id: 'tenders-kenya',
  label: 'Tenders Kenya (tenderskenya.co.ke)',

  isConfigured() {
    return true
  },

  configHint: 'Fetches directly from tenderskenya.co.ke without additional configuration.',

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
      throw new Error(`tenderskenya.co.ke returned HTTP ${response.status}`)
    }

    const html = await response.text()
    return parseTendersKenyaHtml(html)
  },
}
