import type { MetadataRoute } from 'next'

/**
 * Each PNG is listed twice, once per `purpose`. The web manifest spec allows the
 * space-separated `"any maskable"` form, but Next's Manifest type only accepts a
 * single keyword, and two entries sharing a `src` is equivalent and type-safe.
 *
 * Declaring them maskable is legitimate here: they are full-bleed squares whose
 * glyph is inset enough to survive Android's circular mask (see the `scale` note
 * in scripts/generate-icons.mjs).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Quick Tenders',
    short_name: 'Quick Tenders',
    description:
      'An AI agent that finds matching tenders and drafts the bids, so one representative can cover the whole pipeline.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1d4ed8',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
