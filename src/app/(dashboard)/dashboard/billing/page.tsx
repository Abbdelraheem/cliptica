'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Check } from 'lucide-react'

const PLANS = [
  {
    name: 'Free',
    role: 'FREE',
    price: '$0',
    period: '/ forever',
    credits: '40 credits to start',
    items: ['Karaoke captions (Hormozi Pop)', '720p exports with mark', 'Up to 3 videos / day'],
  },
  {
    name: 'Clipper',
    role: 'CLIPPER',
    price: '$19',
    period: '/ mo',
    credits: '300 credits / month',
    items: ['No watermark · 1080p 60fps', 'Campaign hub + ledger', 'Motion graphics & zoom effects'],
  },
  {
    name: 'Studio',
    role: 'STUDIO',
    price: '$49',
    period: '/ mo',
    credits: '1,200 credits / month',
    items: ['Priority rendering queue', 'Auto-Pilot watchlists', 'Brand presets & style packs'],
  },
]

export default function BillingPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [liveCredits, setLiveCredits] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && typeof d?.user?.credits === 'number') {
          setLiveCredits(d.user.credits)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const displayCredits = liveCredits ?? session?.user?.credits ?? 0
  const userRole = (session?.user?.role ?? 'FREE').toUpperCase()

  async function upgrade(plan: string) {
    setError('')
    setLoading(plan)
    try {
      // Checkout is a server-side GET redirect (to Stripe Checkout). Navigate
      // the browser there directly — no JSON round-trip needed.
      window.location.href = `/api/billing/checkout?plan=${encodeURIComponent(plan)}`
    } catch {
      setError('Could not start checkout. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">Membership</p>
      <h1 className="display-md mt-2.5">Billing</h1>

      {/* Credits balance */}
      <div className="glass-card mt-10 flex flex-wrap items-center justify-between gap-6 !p-8">
        <div>
          <p className="text-sm font-light text-mist">Credits remaining</p>
          <p className="stat-value mt-1">{displayCredits}</p>
          <div className="mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-pearl/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold to-champagne transition-all"
              style={{ width: `${Math.min(100, (displayCredits / 1200) * 100)}%` }}
            />
          </div>
        </div>
        <div className="text-right">
          <p className="max-w-xs text-sm font-light leading-relaxed text-mist">
            1 كريديت لكل فيديو نهائي. الرصيد الشهري غير المستخدم يترحل لـ 30 يوماً.
          </p>
          {(userRole === 'CLIPPER' || userRole === 'STUDIO') && (
            <a
              href="/api/billing/portal"
              className="btn-lux btn-outline mt-3 !py-1.5 !px-3 !text-xs inline-flex"
            >
              Stripe Customer Portal
            </a>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Plans */}
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = userRole === plan.role || (userRole === 'ADMIN' && plan.role === 'STUDIO')
          return (
            <div key={plan.name} className={`price-ring ${plan.name === 'Clipper' ? 'feat' : ''}`}>
              {isCurrent && (
                <span className="absolute right-5 top-5 rounded-full border border-champagne/40 bg-champagne/10 px-3 py-1 text-[10px] uppercase tracking-widest text-champagne">
                  Current plan
                </span>
              )}
              <p className="text-xs uppercase tracking-[0.24em] text-champagne">{plan.name}</p>
              <p className="mt-3.5 font-display text-4xl font-semibold">
                {plan.price}
                <small className="ml-1 align-middle font-body text-sm font-light text-mist">{plan.period}</small>
              </p>
              <p className="mt-2 text-sm font-light text-gold">{plan.credits}</p>
              <ul className="my-6 grid gap-2.5">
                {plan.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm font-light text-mist">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-champagne" />
                    {item}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                plan.role === 'FREE' ? (
                  <button disabled className="btn-lux btn-outline w-full opacity-50">Current plan</button>
                ) : (
                  <a href="/api/billing/portal" className="btn-lux btn-outline w-full text-center block">
                    Manage subscription
                  </a>
                )
              ) : (
                <div className="space-y-2.5">
                  <button
                    onClick={() => upgrade(plan.name.toLowerCase())}
                    disabled={loading !== null}
                    className={`btn-lux w-full ${plan.name === 'Clipper' ? 'btn-gold' : 'btn-outline'} disabled:opacity-60`}
                  >
                    {loading === plan.name.toLowerCase() ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                  </button>
                  <p className="text-center text-[11px] leading-tight text-mist-2">
                    By continuing you agree to our{' '}
                    <Link href="/terms" className="underline underline-offset-2 hover:text-white">Terms</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="underline underline-offset-2 hover:text-white">Privacy Policy</Link>.
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-8 text-center text-sm font-light text-mist">
        Need invoice history or a custom tier?{' '}
        <a href="mailto:support@getnology.com" className="text-gold underline underline-offset-4">Contact support</a>
      </p>
    </div>
  )
}
