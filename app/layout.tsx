import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Quick Tenders',
  description:
    'An AI agent that finds matching tenders and drafts the bids, so one representative can cover the whole pipeline.',
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
