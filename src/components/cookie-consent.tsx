'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Cookie, X } from 'lucide-react'

export function CookieConsent() {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setMounted(true)
    const consent = localStorage.getItem('cliptica_cookie_consent')
    if (!consent) {
      // Delay display slightly so it doesn't jarringly block initial render
      const timer = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  if (!mounted || !visible) return null

  const handleConsent = (choice: 'all' | 'essential') => {
    try {
      localStorage.setItem('cliptica_cookie_consent', choice)
    } catch {}
    setVisible(false)
  }

  return (
    <aside
      role="region"
      aria-label="Cookie preferences"
      className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl border border-hair/70 bg-[#0d0d10]/95 p-5 shadow-[0_15px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-300 sm:max-w-md"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold/20 to-champagne/10 border border-gold/30 text-gold">
          <Cookie className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-pearl">Cookie & Privacy Notice</h3>
            <button
              onClick={() => handleConsent('essential')}
              className="text-mist hover:text-pearl transition-colors"
              aria-label="Dismiss cookie notice"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-mist">
            We use strictly necessary cookies to keep you signed in, secure your account, and optimize video generation performance.{' '}
            <Link
              href="/privacy"
              className="text-gold underline underline-offset-2 hover:text-champagne transition-colors"
            >
              Read our Privacy Policy
            </Link>.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleConsent('all')}
              className="btn-lux btn-gold !py-1.5 !px-4 text-xs font-semibold"
            >
              Accept All
            </button>
            <button
              onClick={() => handleConsent('essential')}
              className="btn-lux btn-outline !py-1.5 !px-3 text-xs text-mist hover:text-pearl"
            >
              Essential Only
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
