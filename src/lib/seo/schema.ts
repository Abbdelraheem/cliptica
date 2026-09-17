import {
  PRODUCT_NAME,
  SITE_URL,
  ONE_LINER,
  FOUNDER_NAME,
  FOUNDER_ROLE,
} from './constants'

export interface FAQItem {
  question: string
  answer: string
}

export interface BreadcrumbItem {
  name: string
  url: string
}

/**
 * Organization Schema
 * Strictly anchors entity disambiguation and official social corroboration profiles.
 */
export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: PRODUCT_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    description: ONE_LINER,
    founder: {
      '@type': 'Person',
      name: FOUNDER_NAME,
      jobTitle: FOUNDER_ROLE,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@clipzila.com',
      contactType: 'customer support',
      availableLanguage: ['English', 'Arabic'],
    },
    sameAs: [
      'https://twitter.com/clipzila',
      'https://github.com/Abbdelraheem/clipzila',
    ],
  }
}

/**
 * WebSite Schema with Sitelinks SearchBox
 */
export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: PRODUCT_NAME,
    description: ONE_LINER,
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    inLanguage: ['en', 'ar', 'de', 'fr', 'es'],
  }
}

/**
 * SoftwareApplication Schema
 * Direct offers and verified pricing tiers ($0 Free, $29 Starter, $59 Pro Creator).
 */
export function buildSoftwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#software`,
    name: PRODUCT_NAME,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'All (Web-based SaaS)',
    description: ONE_LINER,
    url: SITE_URL,
    offers: [
      {
        '@type': 'Offer',
        name: 'Free Trial',
        price: '0.00',
        priceCurrency: 'USD',
        description: '15 free video generation credits with watermarked 720p exports.',
      },
      {
        '@type': 'Offer',
        name: 'Basic Plan',
        price: '15.00',
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '15.00',
          priceCurrency: 'USD',
          unitText: 'MONTH',
        },
        description: '50 credits per month, 1080p exports, no watermark, all 18 subtitle styles.',
      },
      {
        '@type': 'Offer',
        name: 'Starter Plan',
        price: '29.00',
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '29.00',
          priceCurrency: 'USD',
          unitText: 'MONTH',
        },
        description: '120 credits per month, 1080p exports, no watermark, Arabic Luxury subtitles.',
      },
      {
        '@type': 'Offer',
        name: 'Pro Creator Plan',
        price: '59.00',
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '59.00',
          priceCurrency: 'USD',
          unitText: 'MONTH',
        },
        description: '400 credits per month, priority queue, AutoPilot channel watchlists.',
      },
    ],
    featureList: [
      'Automatic viral moment detection via LLM AI',
      'Whisper speech recognition with word-accurate timestamps',
      '18 dynamic karaoke subtitle presets with Arabic typography',
      'Intelligent face-tracking and podcast split-screen auto-reframing',
      'Whop Content Rewards campaign video ingestion',
      'Direct social publishing to TikTok, Instagram Reels, and YouTube Shorts',
    ],
  }
}

/**
 * FAQPage Schema
 * Maps question-and-answer pairs directly for Google rich snippets & AI Overviews.
 */
export function buildFAQSchema(items: FAQItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

/**
 * BreadcrumbList Schema
 */
export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}
