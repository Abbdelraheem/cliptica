import { describe, it, expect } from 'vitest'
import { messages } from '../src/lib/i18n'
import { LOCALES, DEFAULT_LOCALE, isCrawler, COUNTRY_TO_LOCALE, RTL_LOCALES } from '../src/lib/seo/constants'
import { getLocaleUrl, buildHreflangAlternates } from '../src/lib/seo/metadata'

describe('Multilingual SEO & Message Parity', () => {
  const defaultKeys = Object.keys(messages[DEFAULT_LOCALE])

  it('guarantees 100% top-level key parity across all 5 language catalogs', () => {
    for (const loc of LOCALES) {
      const cat = messages[loc]
      expect(cat).toBeDefined()
      expect(cat.locale).toBe(loc)
      expect(Object.keys(cat).sort()).toEqual(defaultKeys.sort())
    }
  })

  it('guarantees geoAnswer and compare sections exist and have matching keys across all locales', () => {
    const defaultGeoKeys = Object.keys(messages[DEFAULT_LOCALE].geoAnswer)
    const defaultCompareKeys = Object.keys(messages[DEFAULT_LOCALE].compare)
    const defaultPricingKeys = Object.keys(messages[DEFAULT_LOCALE].pricingSection)

    for (const loc of LOCALES) {
      const cat = messages[loc]
      expect(Object.keys(cat.geoAnswer).sort()).toEqual(defaultGeoKeys.sort())
      expect(Object.keys(cat.compare).sort()).toEqual(defaultCompareKeys.sort())
      expect(Object.keys(cat.pricingSection).sort()).toEqual(defaultPricingKeys.sort())
      expect(cat.faqs.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('correctly flags RTL locales', () => {
    expect(RTL_LOCALES).toContain('ar')
    expect(messages.ar.dir).toBe('rtl')
    expect(messages.en.dir).toBe('ltr')
    expect(messages.de.dir).toBe('ltr')
    expect(messages.fr.dir).toBe('ltr')
    expect(messages.es.dir).toBe('ltr')
  })

  it('generates correct unprefixed canonical for English and prefixed for other locales', () => {
    expect(getLocaleUrl('en')).toBe('https://cliptica.com')
    expect(getLocaleUrl('en', 'pricing')).toBe('https://cliptica.com/pricing')
    expect(getLocaleUrl('en', 'compare')).toBe('https://cliptica.com/compare')

    expect(getLocaleUrl('ar')).toBe('https://cliptica.com/ar')
    expect(getLocaleUrl('ar', 'pricing')).toBe('https://cliptica.com/ar/pricing')
    expect(getLocaleUrl('de', 'compare')).toBe('https://cliptica.com/de/compare')
    expect(getLocaleUrl('fr', 'pricing')).toBe('https://cliptica.com/fr/pricing')
    expect(getLocaleUrl('es', 'compare')).toBe('https://cliptica.com/es/compare')
  })

  it('builds complete reciprocal hreflang alternates with x-default', () => {
    const alternates = buildHreflangAlternates('compare')
    expect(alternates['en']).toBe('https://cliptica.com/compare')
    expect(alternates['ar']).toBe('https://cliptica.com/ar/compare')
    expect(alternates['de']).toBe('https://cliptica.com/de/compare')
    expect(alternates['fr']).toBe('https://cliptica.com/fr/compare')
    expect(alternates['es']).toBe('https://cliptica.com/es/compare')
    expect(alternates['x-default']).toBe('https://cliptica.com/compare')
  })

  it('accurately identifies AI search and search engine crawlers', () => {
    // OpenAI / ChatGPT bots
    expect(isCrawler('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)')).toBe(true)
    expect(isCrawler('OAI-SearchBot/1.0')).toBe(true)
    expect(isCrawler('ChatGPT-User/1.0')).toBe(true)

    // Anthropic / Claude
    expect(isCrawler('ClaudeBot/1.0')).toBe(true)
    expect(isCrawler('anthropic-ai')).toBe(true)

    // Perplexity
    expect(isCrawler('PerplexityBot/1.0')).toBe(true)

    // Google / Bing
    expect(isCrawler('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true)
    expect(isCrawler('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe(true)
    expect(isCrawler('Google-Extended')).toBe(true)

    // Apple
    expect(isCrawler('Applebot/0.1')).toBe(true)

    // Normal browser
    expect(isCrawler('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36')).toBe(false)
    expect(isCrawler('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')).toBe(false)
    expect(isCrawler(null)).toBe(false)
  })

  it('maps target countries to appropriate locales', () => {
    expect(COUNTRY_TO_LOCALE['SA']).toBe('ar')
    expect(COUNTRY_TO_LOCALE['AE']).toBe('ar')
    expect(COUNTRY_TO_LOCALE['EG']).toBe('ar')
    expect(COUNTRY_TO_LOCALE['DE']).toBe('de')
    expect(COUNTRY_TO_LOCALE['AT']).toBe('de')
    expect(COUNTRY_TO_LOCALE['FR']).toBe('fr')
    expect(COUNTRY_TO_LOCALE['ES']).toBe('es')
    expect(COUNTRY_TO_LOCALE['MX']).toBe('es')
    expect(COUNTRY_TO_LOCALE['US']).toBeUndefined() // defaults to en
  })
})
