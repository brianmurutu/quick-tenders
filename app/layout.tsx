import type { Metadata } from 'next'

import { getSiteUrl } from '@/lib/env'
import './globals.css'

const description =
  'An AI agent that finds matching tenders and drafts the bids, so one representative can cover the whole pipeline.'

/**
 * `metadataBase` is what resolves the relative Open Graph image URL to an
 * absolute one, which social crawlers require. Falls back to localhost so a dev
 * checkout without the env var still builds.
 *
 * Icons are not declared here: the App Router picks up app/icon.svg,
 * app/favicon.ico, app/apple-icon.png and app/manifest.ts by filename, and
 * listing them again would emit duplicate <link> tags.
 */
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'Quick Tenders',
    template: '%s · Quick Tenders',
  },
  description,
  applicationName: 'Quick Tenders',
  openGraph: {
    type: 'website',
    siteName: 'Quick Tenders',
    title: 'Quick Tenders',
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Quick Tenders',
    description,
  },
}

export const viewport = {
  themeColor: '#1d4ed8',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
