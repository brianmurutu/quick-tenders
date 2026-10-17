import type { MetadataRoute } from 'next'

import { getSiteUrl } from '@/lib/env'

const publicPaths = [
  '/',
  '/about',
  '/careers',
  '/contact',
  '/privacy',
  '/security',
  '/terms',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl()

  return publicPaths.map((path) => ({
    url: new URL(path, siteUrl).toString(),
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.5,
  }))
}
