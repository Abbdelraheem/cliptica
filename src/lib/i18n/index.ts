import { en } from './messages/en'
import { ar } from './messages/ar'
import { de } from './messages/de'
import { fr } from './messages/fr'
import { es } from './messages/es'
import { type MessageCatalog } from './types'
import { type Locale, DEFAULT_LOCALE, RTL_LOCALES } from '../seo/constants'

export * from './types'

export const messages: Record<Locale, MessageCatalog> = {
  en,
  ar,
  de,
  fr,
  es,
}

export function getMessages(locale: string): MessageCatalog {
  const loc = locale.toLowerCase() as Locale
  return messages[loc] || messages[DEFAULT_LOCALE]
}

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(locale as Locale) ? 'rtl' : 'ltr'
}
