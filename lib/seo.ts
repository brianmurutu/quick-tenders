import type { Metadata } from 'next'

const SITE_NAME = 'Quick Tenders'

export function publicPageMetadata({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path: string
}): Metadata {
  const fullTitle = `${title} · ${SITE_NAME}`

  return {
    title: {
      absolute: fullTitle,
    },
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url: path,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
  }
}

export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
}
