/**
 * TendersInfo (tendersinfo.com).
 *
 * ---------------------------------------------------------------------------
 * CRAWL POLICY & API CONSUMPTION
 * ---------------------------------------------------------------------------
 *
 * robots.txt was verified on 23 September 2026. https://www.tendersinfo.com/robots.txt
 * explicitly permits modern AI and automated bots (ChatGPT, ClaudeBot, AnthropicBot,
 * GPTBot, Gemini, etc.).
 *
 * Rather than fragile HTML scraping, TendersInfo exposes an unauthenticated DataTables
 * search endpoint (/esearch/tender_sector_test) that supplies clean JSON records.
 */

import {
  normaliseTenders,
  parseDeadline,
  stripHtml,
  type RawTender,
  type TenderSource,
} from './types'

const API_URL = 'https://www.tendersinfo.com/esearch/tender_sector_test'
const FETCH_TIMEOUT_MS = 15_000
const FALLBACK_ENTITY = 'TendersInfo'
const KENYA_COUNTRY_CODE = '0100404'
const PAGE_SIZE = 50

type TendersInfoItem = {
  site_tender_id?: string
  short_desc?: string
  url?: string
  doc_last?: string
  authority?: string
  sector_name?: string
  date_c?: string
}

type TendersInfoResponse = {
  recordsTotal?: number
  data?: TendersInfoItem[]
}

export const tendersInfoSource: TenderSource = {
  id: 'tendersinfo',
  label: 'TendersInfo (tendersinfo.com)',

  isConfigured() {
    return true
  },

  configHint: 'Fetches Kenya procurement records from the TendersInfo search API.',

  async fetchTenders(): Promise<RawTender[]> {
    const formData = new URLSearchParams()
    formData.append('countrytxt', KENYA_COUNTRY_CODE)
    formData.append('country_code', 'KE')
    formData.append('sectortxt', '')
    formData.append('region_txt', '')
    formData.append('cpvtxt', '')
    formData.append('notice_type', '')
    formData.append('authoritytxt', '[]')
    formData.append('start', '0')
    formData.append('length', String(PAGE_SIZE))

    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        accept: 'application/json, text/javascript, */*; q=0.01',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`tendersinfo.com returned HTTP ${response.status}`)
    }

    const payload = (await response.json()) as TendersInfoResponse
    const items = Array.isArray(payload.data) ? payload.data : []

    const tenders: RawTender[] = items.map((item) => {
      const title = stripHtml(item.short_desc ?? '')
      const source_url = (item.url ?? '').trim()
      const deadline = parseDeadline(item.doc_last)
      const procuring_entity = stripHtml(item.authority ?? '') || FALLBACK_ENTITY
      const sector = stripHtml(item.sector_name ?? '')

      const description = [title, sector ? `Sector: ${sector}` : '', `Procuring Entity: ${procuring_entity}`]
        .filter(Boolean)
        .join('. ')

      return {
        title,
        source_url,
        deadline,
        description,
        procuring_entity,
      }
    })

    const { tenders: normalised } = normaliseTenders(tenders, FALLBACK_ENTITY)
    return normalised
  },
}
