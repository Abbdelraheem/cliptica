'use client'

import { useState, useRef, useEffect } from 'react'
import { Globe, ChevronDown, Check } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { LOCALES, LOCALE_NAMES, type Locale, DEFAULT_LOCALE } from '@/lib/seo/constants'

export function LanguageSwitcher({ currentLocale = DEFAULT_LOCALE }: { currentLocale?: Locale }) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname() || '/'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [activeLocale, setActiveLocale] = useState<Locale>(currentLocale)

  useEffect(() => {
    // Read stored locale from cookie or document
    const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([a-z]{2})/)
    if (match && match[1] && LOCALES.includes(match[1] as Locale)) {
      setActiveLocale(match[1] as Locale)
    }
  }, [])

  const handleSelectLocale = (targetLocale: Locale) => {
    // Set 1-year persistence cookies for Next.js and in-place translator
    document.cookie = `NEXT_LOCALE=${targetLocale}; path=/; max-age=31536000; SameSite=Lax`
    document.cookie = `googtrans=/auto/${targetLocale}; path=/; max-age=31536000; SameSite=Lax`
    try {
      document.cookie = `googtrans=/auto/${targetLocale}; path=/; domain=.clipzila.com; max-age=31536000; SameSite=Lax`
    } catch {}

    setActiveLocale(targetLocale)
    if (targetLocale === 'ar') {
      document.documentElement.setAttribute('dir', 'rtl')
      document.documentElement.setAttribute('lang', 'ar')
    } else {
      document.documentElement.setAttribute('dir', 'ltr')
      document.documentElement.setAttribute('lang', targetLocale)
    }

    // If currently on legacy prefixed subpath (e.g. /ar), normalize to clean path
    const segments = pathname.split('/').filter(Boolean)
    const currentFirstSeg = segments[0] as Locale | undefined
    if (currentFirstSeg && LOCALES.includes(currentFirstSeg)) {
      const subPath = segments.slice(1).join('/')
      router.push(subPath ? `/${subPath}` : '/')
    } else {
      // Trigger in-place reload/refresh of messages without changing URL
      window.dispatchEvent(new CustomEvent('localechange', { detail: targetLocale }))
      window.location.reload()
    }

    setOpen(false)
  }

  const activeLocaleMeta = LOCALE_NAMES[activeLocale] || LOCALE_NAMES[currentLocale] || LOCALE_NAMES[DEFAULT_LOCALE]

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-xl border border-hair/60 bg-onyx-2/80 px-3 py-1.5 text-xs font-medium text-pearl backdrop-blur transition-colors hover:border-gold/40 hover:text-white"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Globe className="h-3.5 w-3.5 text-gold" />
        <span>{activeLocaleMeta.flag} {activeLocaleMeta.nativeName}</span>
        <ChevronDown className={`h-3 w-3 text-mist transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-2xl border border-hair bg-onyx-2/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-mist-2">
            Select Language
          </div>
          {LOCALES.map((loc) => {
            const info = LOCALE_NAMES[loc]
            const isSelected = loc === activeLocale

            return (
              <button
                key={loc}
                type="button"
                onClick={() => handleSelectLocale(loc)}
                className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-colors ${
                  isSelected
                    ? 'bg-gold/15 font-semibold text-champagne'
                    : 'text-mist hover:bg-white/5 hover:text-pearl'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{info.flag}</span>
                  <span>{info.nativeName}</span>
                  <span className="text-[10px] text-mist-2">({info.name})</span>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-gold" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
