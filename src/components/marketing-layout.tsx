'use client'

import { ReactNode, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Scissors } from 'lucide-react'

export function MarketingLayout({ children }: { children: ReactNode }) {
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const els = document.querySelectorAll('.rv')
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
      { threshold: 0.12 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="relative min-h-screen bg-onyx text-pearl">
      <div className="amb" aria-hidden="true" />

      {/* Nav */}
      <header ref={navRef} className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-5">
        <div className="flex items-center gap-8 rounded-full border border-hair bg-onyx-2/60 py-2.5 pl-6 pr-3 shadow-[0_10px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Cliptica home">
            <span className="flex h-7 w-7 rotate-45 items-center justify-center rounded-[6px] bg-gradient-to-br from-gold to-emerald-deep shadow-[0_0_14px_rgba(216,182,118,0.5)]">
              <Scissors className="h-3.5 w-3.5 -rotate-45 text-onyx" />
            </span>
            <span className="font-display text-xl font-semibold tracking-wide">Cliptica</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
            {[
              ['Features', '/#features'],
              ['Atelier', '/#how'],
              ['Pricing', '/#pricing'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="text-sm text-mist transition-colors duration-300 hover:text-gold"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm text-pearl transition-colors duration-300 hover:text-gold"
            >
              Log in
            </Link>
            <Link href="/register" className="btn-lux btn-gold !px-5 !py-2.5 !text-sm">
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-[2]">{children}</main>

      {/* Footer */}
      <footer className="relative z-[2] mt-24 border-t border-hair/50 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="space-y-4">
              <Link href="/" className="flex items-center gap-2.5" aria-label="Cliptica home">
                <span className="flex h-7 w-7 rotate-45 items-center justify-center rounded-[6px] bg-gradient-to-br from-gold to-emerald-deep">
                  <Scissors className="h-3.5 w-3.5 -rotate-45 text-onyx" />
                </span>
                <span className="font-display text-xl font-semibold tracking-wide">Cliptica</span>
              </Link>
              <p className="max-w-xs text-sm font-light leading-relaxed text-mist">
                Built like an editorial team, priced like software.
              </p>
            </div>
            {[
              {
                title: 'Product',
                links: [
                  ['Features', '/#features'],
                  ['Pricing', '/#pricing'],
                  ['Testimonials', '/#testimonials'],
                ],
              },
              {
                title: 'Company',
                links: [
                  ['About', '/about'],
                  ['Blog', '/blog'],
                  ['Careers', '/careers'],
                ],
              },
              {
                title: 'Legal',
                links: [
                  ['Privacy', '/privacy'],
                  ['Terms', '/terms'],
                ],
              },
            ].map((col) => (
              <nav key={col.title} className="space-y-3">
                <h4 className="text-xs uppercase tracking-[0.24em] text-champagne">{col.title}</h4>
                <ul className="space-y-2 text-sm font-light text-mist">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href} className="transition-colors hover:text-gold">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="mt-10 border-t border-hair/30 pt-8 text-center text-sm font-light text-mist-2">
            © {new Date().getFullYear()} Cliptica · Built like an editorial team, priced like software.
          </div>
        </div>
      </footer>
    </div>
  )
}
