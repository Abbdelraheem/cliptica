'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { Wordmark } from '@/components/logo'
import { LanguageSwitcher } from '@/components/language-switcher'
import { type Locale, DEFAULT_LOCALE } from '@/lib/seo/constants'

const NAV_LINKS = [
  ['How It Works', '/#how'],
  ['Features', '/#features'],
  ['Pricing', '/#pricing'],
  ['Compare', '/compare'],
  ['FAQ', '/#faq'],
] as const

export function MarketingLayout({
  children,
  locale = DEFAULT_LOCALE,
}: {
  children: ReactNode
  locale?: Locale
}) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const els = document.querySelectorAll('.rv')
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
      { threshold: 0.12 }
    )
    els.forEach((el) => io.observe(el))

    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <div className="relative min-h-screen text-pearl">

      {/* Floating nav */}
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
        <div
          className={`flex w-full max-w-5xl items-center justify-between rounded-2xl border py-2.5 pl-5 pr-2.5 backdrop-blur-xl transition-all duration-300 ${
            scrolled
              ? 'border-hair bg-[#0a0a0a]/90 shadow-[0_10px_50px_rgba(0,0,0,0.6)]'
              : 'border-hair bg-[#0a0a0a]/55 shadow-[0_10px_50px_rgba(0,0,0,0.35)]'
          }`}
        >
          <Link href="/" aria-label="Clipzila home" className="shrink-0">
            <Wordmark />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
            {NAV_LINKS.map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="text-sm text-mist transition-colors duration-300 hover:text-white"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/help"
              className="text-sm text-mist transition-colors duration-300 hover:text-champagne"
            >
              Help Center
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher currentLocale={locale} />
            <Link
              href="/login"
              className="hidden rounded-xl px-3.5 py-2 text-sm text-mist transition-colors duration-300 hover:text-white sm:block"
            >
              Log In
            </Link>
            <Link href="/register" className="btn-lux btn-primary !rounded-xl !px-4 !py-2 !text-sm">
              Start Free
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-[2]">{children}</main>

      {/* Footer */}
      <footer className="relative z-[2] mt-24 border-t border-hair/60 bg-[#070707]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="space-y-4">
              <Wordmark />
              <p className="max-w-xs text-sm leading-relaxed text-mist">
                One link in. High-bitrate vertical clips out. Built for creators and studios who demand broadcast-grade precision.
              </p>
              <div className="flex gap-3 pt-2">
                {[
                  {
                    name: 'X',
                    url: 'https://x.com/Clipzilaofficial',
                    svg: (
                      <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    ),
                  },
                  {
                    name: 'Instagram',
                    url: 'https://instagram.com/Clipzilaofficial',
                    svg: (
                      <svg className="h-3.5 w-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                      </svg>
                    ),
                  },
                  {
                    name: 'YouTube',
                    url: 'https://youtube.com/@Clipzilaofficial',
                    svg: (
                      <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                      </svg>
                    ),
                  },
                  {
                    name: 'TikTok',
                    url: 'https://tiktok.com/@Clipzilaofficial',
                    svg: (
                      <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.86 4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-3.04-1.52z" />
                      </svg>
                    ),
                  },
                ].map((s) => (
                  <a
                    key={s.name}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.name}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-hair bg-surface text-mist transition-all duration-300 hover:border-champagne/50 hover:text-white hover:shadow-sm hover:shadow-gold/10"
                  >
                    {s.svg}
                  </a>
                ))}
              </div>
            </div>
            {[
              {
                title: 'Product',
                links: [
                  ['How It Works', '/#how'],
                  ['Features', '/#features'],
                  ['Pricing', '/#pricing'],
                  ['Dashboard', '/dashboard'],
                ],
              },
              {
                title: 'Resources',
                links: [
                  ['FAQ', '/#faq'],
                  ['Help Center', '/help'],
                  ['Caption Styles', '/#features'],
                  ['Compare', '/compare'],
                ],
              },
              {
                title: 'Company',
                links: [
                  ['About', '/#how'],
                  ['Contact', 'mailto:support@clipzila.com'],
                  ['Terms', '/terms'],
                  ['Privacy', '/privacy'],
                  ['Refund Policy', '/refund-policy'],
                ],
              },
            ].map((col) => (
              <nav key={col.title} className="space-y-3" aria-label={col.title}>
                <h4 className="text-xs font-semibold uppercase tracking-[0.22em] text-champagne">
                  {col.title}
                </h4>
                <ul className="space-y-2.5 text-sm text-mist">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href} className="transition-colors hover:text-white">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="mt-14 border-t border-hair/40 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-mist-2">
            <p>© {new Date().getFullYear()} Clipzila. All rights reserved.</p>
            <p className="max-w-md text-[11px] leading-relaxed text-mist-2/80">
              Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides customer service inquiries and handles returns.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
