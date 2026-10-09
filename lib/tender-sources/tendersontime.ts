/**
 * TendersOnTime (tendersontime.com).
 *
 * ---------------------------------------------------------------------------
 * CRAWL POLICY & ACCESS CHECK
 * ---------------------------------------------------------------------------
 *
 * robots.txt was checked on 23 September 2026. https://www.tendersontime.com/robots.txt
 * permits public tender listings (disallows only administrative paths like /docs/,
 * /admin/, /wp-login.php).
 */

import {
  normaliseTenders,
  parseDeadline,
  stripHtml,
  type RawTender,
  type TenderSource,
} from './types'

const FALLBACK_ENTITY = 'Government of Kenya (TendersOnTime)'

export function parseTendersOnTimeHtml(html: string): RawTender[] {
  const tenders: RawTender[] = []
  // Matches each listing box
  const boxRegex = /<div class="listingbox[^"]*"[\s\S]*?(?=<div class="listingbox|<\/div>\s*<\/div>\s*<nav|$)/gi
  const boxes = html.match(boxRegex) || []

  for (const box of boxes) {
    const linkMatch = box.match(/<a[^>]+href="([^"]*\/tenders-details\/[^"]*)"[^>]*>[\s\S]*?<p class="listing-summary">([\s\S]*?)<\/p>/i)
    if (!linkMatch) continue

    const source_url = linkMatch[1].trim()
    const rawTitle = stripHtml(linkMatch[2].trim())
    if (!source_url || !rawTitle) continue

    // Extract deadline
    const deadlineMatch = box.match(/Deadline:\s*<strong>([\s\S]*?)<\/strong>/i)
    const deadlineStr = deadlineMatch ? stripHtml(deadlineMatch[1].trim()) : null
    const deadline = parseDeadline(deadlineStr)

    // Extract reference or purchaser if available
    const refMatch = box.match(/TOT Reference No\.?:\s*([0-9a-zA-Z]+)/i)
    const refNo = refMatch ? refMatch[1].trim() : ''

    const title = rawTitle.length > 250 ? `${rawTitle.slice(0, 247)}...` : rawTitle
    const description = [
      rawTitle,
      refNo ? `Ref: ${refNo}` : '',
      `Source: TendersOnTime Kenya`,
    ]
      .filter(Boolean)
      .join('. ')

    tenders.push({
      title,
      source_url,
      deadline,
      description,
      procuring_entity: FALLBACK_ENTITY,
    })
  }

  const { tenders: normalised } = normaliseTenders(tenders, FALLBACK_ENTITY)
  return normalised
}

export const tendersOnTimeSource: TenderSource = {
  id: 'tendersontime',
  label: 'TendersOnTime (tendersontime.com)',
  blockedReason:
    'tendersontime.com employs Cloudflare bot-management / WAF returning HTTP 403 to automated crawlers.',

  isConfigured() {
    return false
  },

  configHint: 'tendersontime.com is protected by Cloudflare bot management (HTTP 403).',

  async fetchTenders(): Promise<RawTender[]> {
    throw new Error('tendersOnTimeSource is currently blocked by Cloudflare (HTTP 403)')
  },
}

