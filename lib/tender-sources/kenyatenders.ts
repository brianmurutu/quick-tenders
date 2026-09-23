/**
 * Kenya Tenders (kenyatenders.com).
 *
 * ---------------------------------------------------------------------------
 * CRAWL POLICY & ACCESS CHECK
 * ---------------------------------------------------------------------------
 *
 * Checked 23 September 2026.
 *
 * robots.txt allows search crawlers and GPTBot. However, kenyatenders.com places
 * tender notices, closing dates, and tender documents behind a mandatory login/paywall
 * (plans.php and login.php). Public category and search pages render only promotional
 * lead-capture banners and headlines without tender deadlines or documents.
 *
 * Per the project policy on paywalled/auth-walled sources, this source is stubbed
 * with an explanatory reason rather than scraping gated or incomplete snippets.
 *
 * To enable: configure an authenticated subscriber feed or direct API contract with
 * the portal operator.
 */

import type { RawTender, TenderSource } from './types'

export const kenyaTendersSource: TenderSource = {
  id: 'kenyatenders',
  label: 'Kenya Tenders (kenyatenders.com)',
  blockedReason:
    'kenyatenders.com requires an authenticated paid account (login.php / plans.php) ' +
    'to access tender documents, reference numbers, and deadlines. Public listings ' +
    'render only lead-capture forms without procurement data.',

  isConfigured() {
    return false
  },

  configHint:
    'Requires an authenticated subscription. Contact KenyaTenders for corporate ' +
    'API access.',

  async fetchTenders(): Promise<RawTender[]> {
    throw new Error('kenyaTendersSource is a stub and must not be called')
  },
}
