import Link from 'next/link'

import { getSiteUrl } from '@/lib/env'

export function Breadcrumbs({
  currentPage,
  currentPath,
}: {
  currentPage: string
  currentPath: string
}) {
  const siteUrl = getSiteUrl()
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: new URL('/', siteUrl).toString(),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: currentPage,
        item: new URL(currentPath, siteUrl).toString(),
      },
    ],
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-slate-600">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link className="underline-offset-4 hover:underline" href="/">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-slate-900">
            {currentPage}
          </li>
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
    </>
  )
}
