'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { Wordmark } from '@/components/logo'

const NAV_LINKS = [
  ['How It Works', '/#how'],
  ['Features', '/#features'],
  ['Pricing', '/#pricing'],
  ['FAQ', '/#faq'],
] as const

export function MarketingLayout({ children }: { children: ReactNode }) {
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
    <div className="relative min-h-screen bg-onyx text-pearl">
      <div className="amb" aria-hidden="true" />

      {/* Floating nav */}
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
        <div
          className={`flex w-full max-w-5xl items-center justify-between rounded-2xl border py-2.5 pl-5 pr-2.5 backdrop-blur-xl transition-all duration-300 ${
            scrolled
              ? 'border-hair bg-[#0a0a0a]/90 shadow-[0_10px_50px_rgba(0,0,0,0.6)]'
              : 'border-hair bg-[#0a0a0a]/55 shadow-[0_10px_50px_rgba(0,0,0,0.35)]'
          }`}
        >
          <Link href="/" aria-label="NOLOGY home" className="shrink-0">
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
          </nav>

          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="hidden rounded-xl px-4 py-2 text-sm text-mist transition-colors duration-300 hover:text-white sm:block"
            >
              Log In
            </Link>
            <Link href="/register" className="btn-lux btn-primary !rounded-xl !px-5 !py-2.5 !text-sm">
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
                One link in. A week of clips out. AI that finds the moments, cuts them vertical,
                and captions them for you.
              </p>
              <div className="flex gap-3 pt-2">
                {['X', 'Instagram', 'YouTube', 'TikTok'].map((s) => (
                  <a
                    key={s}
                    href="#"
                    aria-label={s}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-hair bg-surface text-xs font-semibold text-mist transition-all duration-300 hover:border-champagne/50 hover:text-white"
                  >
                    {s === 'X' ? '𝕏' : s[0]}
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
                  ['Help Center', '#'],
                  ['Caption Styles', '/#features'],
                  ['Changelog', '#'],
                ],
              },
              {
                title: 'Company',
                links: [
                  ['About', '#'],
                  ['Contact', 'mailto:support@getnology.com'],
                  ['Terms', '#'],
                  ['Privacy', '#'],
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
          <div className="mt-14 border-t border-hair/40 pt-8 text-sm text-mist-2">
            © {new Date().getFullYear()} NOLOGY. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
