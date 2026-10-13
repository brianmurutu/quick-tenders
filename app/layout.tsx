import type { Metadata } from 'next'
import { Bricolage_Grotesque, Public_Sans } from 'next/font/google'

import { getSiteUrl } from '@/lib/env'
import './globals.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['600', '800'],
  display: 'swap',
})

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  weight: ['400', '500', '600'],
  display: 'swap',
})

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
  themeColor: '#0F3D2E',
  viewportFit: 'cover' as const,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${bricolage.variable} ${publicSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
