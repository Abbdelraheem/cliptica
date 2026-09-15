import { MetadataRoute } from 'next'
import { SITE_URL, LOCALES, DEFAULT_LOCALE } from '@/lib/seo/constants'
import { getLocaleUrl, buildHreflangAlternates } from '@/lib/seo/metadata'

export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date()

  const publicRoutes = [
    { path: '', changeFrequency: 'daily' as const, priority: 1.0 },
    { path: 'pricing', changeFrequency: 'weekly' as const, priority: 0.9 },
    { path: 'compare', changeFrequency: 'weekly' as const, priority: 0.9 },
  ]

  const sitemapEntries: MetadataRoute.Sitemap = []

  // Add multilingual entries with reciprocal alternates
  for (const route of publicRoutes) {
    for (const locale of LOCALES) {
      const url = getLocaleUrl(locale, route.path)
      const alternates = buildHreflangAlternates(route.path)

      sitemapEntries.push({
        url,
        lastModified: currentDate,
        changeFrequency: route.changeFrequency,
        priority: locale === DEFAULT_LOCALE ? route.priority : route.priority * 0.95,
        alternates: {
          languages: alternates,
        },
      })
    }
  }

  // Add utility & legal pages
  const staticRoutes = [
    { path: 'login', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: 'register', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: 'terms', priority: 0.4, changeFrequency: 'monthly' as const },
    { path: 'privacy', priority: 0.4, changeFrequency: 'monthly' as const },
    { path: 'refund-policy', priority: 0.4, changeFrequency: 'monthly' as const },
  ]

  for (const r of staticRoutes) {
    sitemapEntries.push({
      url: `${SITE_URL}/${r.path}`,
      lastModified: currentDate,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })
  }

  return sitemapEntries
}
