/**
 * County procurement portals.
 *
 * Every county was checked before any code was written, and the findings are
 * recorded against each entry below. Two of the three are stubbed on purpose:
 * one sits behind an auth wall and one has a broken certificate chain. Neither
 * is worked around, per the brief. A stub that says why is more useful than a
 * scraper that quietly returns nothing, or one that only works because it
 * ignored a security control.
 *
 * Counties whose site is public WordPress share one implementation:
 * makeWordPressCountySource below talks to the documented WP REST API rather
 * than parsing markup. That API returns typed JSON, is versioned, and does not
 * break when somebody changes a theme. Guessing CSS selectors against a theme
 * we cannot see would produce code that looks finished and returns zero rows.
 *
 * TODO: add the remaining counties. The 47 are listed in lib/company-profile.ts.
 * For each one, in this order:
 *   1. Fetch /robots.txt and confirm the tender path is not disallowed.
 *   2. Check for a documented feed: /wp-json/wp/v2/... on WordPress, an OCDS
 *      release endpoint, an RSS feed, or a CSV or XLSX export.
 *   3. If it needs a login, a token, or a CAPTCHA, add a stub with the reason.
 *      Do not work around it.
 *   4. Confirm which collection actually holds tender notices before enabling.
 *      Several county sites publish news under a tenders-shaped URL, and a
 *      keyword search over news articles is worse than no source at all.
 */

import {
  normaliseTenders,
  stripHtml,
  type RawTender,
  type TenderSource,
} from './types'

type WordPressCountyConfig = {
  id: string
  label: string
  /** Origin only, no trailing slash. */
  origin: string
  /**
   * REST collection holding tender notices, relative to /wp-json/wp/v2/.
   * 'posts' and 'media' are the usual candidates; a site with a custom post
   * type for procurement will have its own.
   */
  collection: string
  /** Passed as ?search=, to narrow a general collection to procurement items. */
  search?: string
  /** Restricts to one category id, when the site has a tenders category. */
  categoryId?: number
  /** Name recorded as the procuring entity. */
  entity: string
  /**
   * Left false until somebody has confirmed the collection really does hold
   * tender notices for this county. See the Nakuru note.
   */
  enabledByDefault: boolean
  configHint?: string
}

const PER_PAGE = 50
const FETCH_TIMEOUT_MS = 15_000

type WordPressItem = {
  link?: unknown
  source_url?: unknown
  date?: unknown
  title?: { rendered?: unknown }
  excerpt?: { rendered?: unknown }
  content?: { rendered?: unknown }
}

function renderedText(field: { rendered?: unknown } | undefined): string {
  const raw = field?.rendered

  return typeof raw === 'string' ? stripHtml(raw) : ''
}

/**
 * Builds an adapter over the WP REST API.
 *
 * Deliberately does NOT infer a deadline from the publication date. A published
 * date is not a closing date, and inventing one would put a wrong deadline in
 * front of somebody deciding whether they still have time to bid. Deadlines
 * come back null until a source states them, and normaliseTender keeps them
 * null rather than guessing.
 */
export function makeWordPressCountySource(
  config: WordPressCountyConfig,
): TenderSource {
  return {
    id: config.id,
    label: config.label,

    isConfigured() {
      const override = process.env[`TENDER_SOURCE_${config.id.toUpperCase().replace(/-/g, '_')}`]

      if (override === 'true') return true
      if (override === 'false') return false

      return config.enabledByDefault
    },

    configHint: config.configHint,

    async fetchTenders(): Promise<RawTender[]> {
      const url = new URL(`${config.origin}/wp-json/wp/v2/${config.collection}`)
      url.searchParams.set('per_page', String(PER_PAGE))
      url.searchParams.set('orderby', 'date')
      url.searchParams.set('order', 'desc')
      url.searchParams.set('_fields', 'id,date,link,source_url,title,excerpt,content')

      if (config.search) url.searchParams.set('search', config.search)
      if (config.categoryId !== undefined) {
        url.searchParams.set('categories', String(config.categoryId))
      }

      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: 'no-store',
      })

      // 401 and 403 mean the site has closed its API since this was written.
      // Say so plainly instead of retrying with credentials.
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `${config.label} REST API now requires authorisation (HTTP ${response.status}). ` +
            'Stub this source rather than adding credentials.',
        )
      }

      if (!response.ok) {
        throw new Error(`${config.label} REST API returned HTTP ${response.status}`)
      }

      const payload: unknown = await response.json()

      if (!Array.isArray(payload)) {
        throw new Error(`${config.label} REST API did not return a JSON array`)
      }

      const rows = (payload as WordPressItem[]).map((item) => {
        const link =
          typeof item.link === 'string'
            ? item.link
            : typeof item.source_url === 'string'
              ? item.source_url
              : undefined

        const excerpt = renderedText(item.excerpt)
        const content = renderedText(item.content)

        return {
          title: renderedText(item.title),
          source_url: link,
          deadline: null,
          description: excerpt || content,
          procuring_entity: config.entity,
        }
      })

      const { tenders } = normaliseTenders(rows, config.entity)

      return tenders
    },
  }
}

// ---------------------------------------------------------------------------
// Nairobi City County
// ---------------------------------------------------------------------------
//
// Checked 26 August 2026. https://nairobi.go.ke/robots.txt could not be
// retrieved: the TLS handshake fails with "unable to verify the first
// certificate", meaning the server does not serve a complete certificate chain.
//
// Stubbed rather than worked around. Making this fetch succeed would mean
// disabling certificate verification, which turns off the check that the host is
// who it claims to be, for a job that runs unattended on a schedule. That is not
// a trade worth making to read a tender list.
//
// To enable: confirm the chain is fixed (`openssl s_client -connect
// nairobi.go.ke:443 -showcerts`), then re-check robots.txt and whether a
// documented feed exists, and replace this stub.
export const nairobiCountySource: TenderSource = {
  id: 'county-nairobi',
  label: 'Nairobi City County',
  blockedReason:
    'TLS certificate chain does not verify (incomplete chain served). Not ' +
    'bypassed: disabling certificate verification for a scheduled job is not ' +
    'an acceptable workaround.',
  isConfigured() {
    return false
  },
  async fetchTenders() {
    throw new Error('nairobiCountySource is a stub and must not be called')
  },
}

// ---------------------------------------------------------------------------
// Kiambu County
// ---------------------------------------------------------------------------
//
// Checked 26 August 2026.
//
// robots.txt permits crawling everything except /wp-admin/:
//
//     User-agent: *
//     Disallow: /wp-admin/
//     Allow: /wp-admin/admin-ajax.php
//     Sitemap: https://kiambu.go.ke/wp-sitemap.xml
//
// So crawling is allowed. The blocker is different: the WordPress REST API at
// /wp-json/wp/v2/ returns HTTP 401 Unauthorized. The site has locked its API to
// authenticated callers.
//
// Stubbed rather than worked around. The brief is explicit and it is the right
// call regardless: we have no account, no permission to hold one, and routing
// around a 401 is unauthorised access whatever the robots file says. Scraping
// the HTML instead would be technically permitted by robots.txt, but it would be
// deliberately circumventing the access control the operator just applied to the
// same data.
//
// To enable: ask Kiambu County for API access or a data-sharing arrangement in
// writing, then add a source that reads the credential from the environment.
export const kiambuCountySource: TenderSource = {
  id: 'county-kiambu',
  label: 'Kiambu County',
  blockedReason:
    'WordPress REST API returns HTTP 401 Unauthorized. Not bypassed: the ' +
    'operator has put this data behind authentication, so reading it needs ' +
    'their permission, not a different transport.',
  isConfigured() {
    return false
  },
  async fetchTenders() {
    throw new Error('kiambuCountySource is a stub and must not be called')
  },
}

// ---------------------------------------------------------------------------
// Nakuru County
// ---------------------------------------------------------------------------
//
// Checked 26 August 2026. This one is implemented, because it is the one that
// can be.
//
// robots.txt permits the content paths (it blocks only /wp-admin/ and some
// WooCommerce upload and cart paths), and the WordPress REST API at
// /wp-json/wp/v2/ is public: it answers with valid JSON and no auth.
//
// It ships DISABLED anyway, and that is the honest part. Two searches were run:
//
//   /wp-json/wp/v2/posts?search=tender  -> 5 results, all county news and press
//                                          releases. No reference numbers, no
//                                          bid specifications, no closing dates.
//   /wp-json/wp/v2/media?search=tender  -> empty.
//
// The API works; the tender notices are not in either collection. Enabling a
// keyword search over a news feed would fill tenders_matched with press releases
// and burn Grok tokens scoring them, which is worse than having no source.
//
// To enable: find the collection that actually holds notices. Start with
// /wp-json/wp/v2/types and /wp-json/wp/v2/categories to look for a procurement
// custom post type or category, set `collection` and `categoryId` accordingly,
// then set TENDER_SOURCE_COUNTY_NAKURU=true.
export const nakuruCountySource: TenderSource = makeWordPressCountySource({
  id: 'county-nakuru',
  label: 'Nakuru County',
  origin: 'https://www.nakuru.go.ke',
  collection: 'posts',
  search: 'tender',
  entity: 'Nakuru County Government',
  enabledByDefault: false,
  configHint:
    'REST API is public and permitted, but tender notices were not found in ' +
    'posts or media. Confirm the right collection, then set ' +
    'TENDER_SOURCE_COUNTY_NAKURU=true. See the note in lib/tender-sources/county.ts.',
})

export const countySources: TenderSource[] = [
  nairobiCountySource,
  kiambuCountySource,
  nakuruCountySource,
]
