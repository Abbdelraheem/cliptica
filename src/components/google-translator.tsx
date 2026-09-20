'use client'

import { useEffect } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement?: {
          new (options: unknown, elementId: string): unknown
          InlineLayout?: {
            SIMPLE: number
          }
        }
      }
    }
    googleTranslateElementInit?: () => void
  }
}

export function GoogleTranslator() {
  useEffect(() => {
    // Define global callback expected by Google Translate script
    window.googleTranslateElementInit = () => {
      try {
        if (window.google?.translate?.TranslateElement) {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: 'en',
              includedLanguages: 'en,ar,de,fr,es',
              autoDisplay: false,
            },
            'google_translate_element'
          )
        }
      } catch (e) {
        console.warn('Google Translate initialization:', e)
      }
    }

    // Sync RTL/LTR direction based on current cookies
    const cookies = document.cookie || ''
    const isArabic =
      cookies.includes('googtrans=/auto/ar') ||
      cookies.includes('googtrans=/en/ar') ||
      cookies.includes('NEXT_LOCALE=ar')

    if (isArabic) {
      document.documentElement.setAttribute('dir', 'rtl')
      document.documentElement.setAttribute('lang', 'ar')
    } else {
      document.documentElement.setAttribute('dir', 'ltr')
    }
  }, [])

  return (
    <>
      <div
        id="google_translate_element"
        style={{ display: 'none', position: 'absolute', top: '-9999px', left: '-9999px' }}
        aria-hidden="true"
      />
      <Script
        src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
    </>
  )
}
