/**
 * TenderSoko (tendersoko.com).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS STUBBED
 * ---------------------------------------------------------------------------
 *
 * Checked 23 September 2026. https://www.tendersoko.com/robots.txt states:
 *
 *   "Notice: Automated scraping of proprietary tender data is prohibited."
 *   User-agent: GPTBot, Claude-Web, Anthropic-ai, CCBot, Google-Extended
 *   Disallow: /
 *
 * The operator explicitly prohibits automated scraping of proprietary data and
 * blocks LLM/AI scrapers. In accordance with the Quick Tender engineering policy,
 * this source is stubbed rather than worked around.
 *
 * To enable: contact TenderSoko for an official data-sharing partnership or API
 * access, then update this adapter to use authenticated API credentials.
 */

import type { RawTender, TenderSource } from './types'

export const tendersokoSource: TenderSource = {
  id: 'tendersoko',
  label: 'TenderSoko (tendersoko.com)',
  blockedReason:
    'tendersoko.com robots.txt explicitly declares automated scraping of ' +
    'proprietary tender data prohibited and blocks automated scrapers. Stubbed ' +
    'per project policy until an authorized data partnership or API key is arranged.',

  isConfigured() {
    return false
  },

  configHint:
    'TenderSoko prohibits automated scraping. Contact info@tendersoko.com for ' +
    'partnership/API access.',

  async fetchTenders(): Promise<RawTender[]> {
    throw new Error('tendersokoSource is a stub and must not be called')
  },
}
