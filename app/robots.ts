import type { MetadataRoute } from 'next'

import { getSiteUrl } from '@/lib/env'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/dashboard', '/api/', '/auth/callback'],
    },
    sitemap: new URL('/sitemap.xml', getSiteUrl()).toString(),
  }
}
