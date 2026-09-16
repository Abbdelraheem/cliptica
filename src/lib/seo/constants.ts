/**
 * Clipzila SEO & Generative Engine Optimization (GEO) Constants
 * Frozen entity definitions and multilingual locale configurations.
 */

export const PRODUCT_NAME = 'Clipzila'
export const SITE_URL = process.env.NEXTAUTH_URL || 'https://clipzila.com'

/**
 * Frozen ONE_LINER — used verbatim across metadata, schema, llms.txt,
 * social profiles, and knowledge graphs to anchor entity disambiguation.
 */
export const ONE_LINER =
  'Clipzila is an AI-powered video clipping platform that turns long YouTube videos and podcasts into viral short-form clips with automated Arabic and English karaoke captions, speaker face tracking, and viral moment scoring.'

export const CATEGORY_TERMS = [
  'AI video clipping',
  'podcast to shorts',
  'TikTok video repurposing',
  'Arabic karaoke captions',
  'Whop Content Rewards clipping',
  'YouTube Shorts generator',
] as const

export const COMPETITORS = ['Opus Clip', 'Klap', 'Submagic', 'Vizard'] as const

export const FOUNDER_NAME = 'Dr. Abdelraheem'
export const FOUNDER_ROLE = 'Founder & Lead Architect'

export const LOCALES = ['en', 'ar', 'de', 'fr', 'es'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'
export const RTL_LOCALES: Locale[] = ['ar']

export const LOCALE_NAMES: Record<Locale, { name: string; nativeName: string; dir: 'ltr' | 'rtl'; flag: string }> = {
  en: { name: 'English', nativeName: 'English', dir: 'ltr', flag: '🇺🇸' },
  ar: { name: 'Arabic', nativeName: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  de: { name: 'German', nativeName: 'Deutsch', dir: 'ltr', flag: '🇩🇪' },
  fr: { name: 'French', nativeName: 'Français', dir: 'ltr', flag: '🇫🇷' },
  es: { name: 'Spanish', nativeName: 'Español', dir: 'ltr', flag: '🇪🇸' },
}

/**
 * Maps incoming IP country headers to supported target locales.
 * Countries not listed default to DEFAULT_LOCALE (en).
 */
export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  // MENA (Arabic)
  SA: 'ar', AE: 'ar', EG: 'ar', QA: 'ar', KW: 'ar', BH: 'ar', OM: 'ar',
  JO: 'ar', LB: 'ar', IQ: 'ar', MA: 'ar', DZ: 'ar', TN: 'ar', LY: 'ar',
  YE: 'ar', SD: 'ar', PS: 'ar',
  // DACH (German)
  DE: 'de', AT: 'de', CH: 'de',
  // Francophone (French)
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr',
  // Hispanophone (Spanish)
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es',
}

/**
 * Comprehensive regex matching major search engine crawlers, social bots,
 * and AI retrieval agents. Crawlers MUST NEVER be redirected by country IP.
 */
export const CRAWLER_USER_AGENT_REGEX =
  /Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|Exabot|facebot|facebookexternalhit|Twitterbot|LinkedInBot|Pinterestbot|Slackbot|TelegramBot|Applebot|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|anthropic-ai|PerplexityBot|Google-Extended|Amazonbot|Diffbot/i

export function isCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return CRAWLER_USER_AGENT_REGEX.test(userAgent)
}

export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.includes(locale as Locale)
}

export function isValidLocale(locale: string): locale is Locale {
  return LOCALES.includes(locale as Locale)
}
