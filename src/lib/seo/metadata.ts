import type { Metadata } from 'next'
import {
  PRODUCT_NAME,
  SITE_URL,
  ONE_LINER,
  LOCALES,
  DEFAULT_LOCALE,
  type Locale,
} from './constants'

export interface PageMetadataOptions {
  locale?: Locale
  path?: string // e.g. '', 'pricing', 'compare'
  title?: string
  description?: string
  keywords?: string[]
  noIndex?: boolean
}

/**
 * Builds the canonical URL for a given locale and subpath.
 * English (DEFAULT_LOCALE) is unprefixed; others are prefixed.
 */
export function getLocaleUrl(locale: Locale, subPath = ''): string {
  const cleanPath = subPath.replace(/^\/+|\/+$/g, '')
  const pathSegment = cleanPath ? `/${cleanPath}` : ''

  if (locale === DEFAULT_LOCALE) {
    return `${SITE_URL}${pathSegment}` || SITE_URL
  }

  return `${SITE_URL}/${locale}${pathSegment}`
}

/**
 * Builds reciprocal hreflang alternate links for all supported locales + x-default.
 */
export function buildHreflangAlternates(subPath = ''): Record<string, string> {
  const languages: Record<string, string> = {}

  for (const loc of LOCALES) {
    languages[loc] = getLocaleUrl(loc, subPath)
  }

  // x-default points to the default language (English, unprefixed)
  languages['x-default'] = getLocaleUrl(DEFAULT_LOCALE, subPath)

  return languages
}

/**
 * Assembles robust Next.js Metadata with canonical URLs, reciprocal hreflang,
 * OpenGraph, Twitter card, and AI crawler visibility tags.
 */
export function buildPageMetadata({
  locale = DEFAULT_LOCALE,
  path = '',
  title,
  description = ONE_LINER,
  keywords,
  noIndex = false,
}: PageMetadataOptions): Metadata {
  const pageTitle = title ? `${title} | ${PRODUCT_NAME}` : `${PRODUCT_NAME} — One video in. A week of clips out.`
  const canonicalUrl = getLocaleUrl(locale, path)
  const alternatesLanguages = buildHreflangAlternates(path)

  const defaultKeywords = [
    'AI video clipping',
    'repurpose video to shorts',
    'podcast to TikTok',
    'Arabic karaoke captions',
    'viral moment detector',
    'Whop content rewards',
    'Opus Clip alternative',
  ]

  return {
    title: pageTitle,
    description,
    keywords: keywords || defaultKeywords,
    alternates: {
      canonical: canonicalUrl,
      languages: alternatesLanguages,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      title: pageTitle,
      description,
      siteName: PRODUCT_NAME,
      locale: locale === 'ar' ? 'ar_AR' : locale === 'de' ? 'de_DE' : locale === 'fr' ? 'fr_FR' : locale === 'es' ? 'es_ES' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
    },
  }
}
