'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/ forever',
    credits: '40 credits to start',
    items: ['All 15 caption styles', '720p exports with mark', 'Up to 3 videos / day'],
    current: true,
  },
  {
    name: 'Clipper',
    price: '$19',
    period: '/ mo',
    credits: '300 credits / month',
    items: ['No watermark · 1080p 60fps', 'Campaign hub + ledger', 'Motion graphics, music & SFX'],
    current: false,
  },
  {
    name: 'Studio',
    price: '$49',
    period: '/ mo',
    credits: '1,200 credits / month',
    items: ['Priority rendering queue', 'Auto-Pilot watchlists', 'Brand presets & style packs'],
    current: false,
  },
]

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null)

  async function upgrade(plan: string) {
    setLoading(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data?.url) window.location.href = data.url
    } finally {
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
          <p className="stat-value mt-1">240</p>
          <div className="mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-pearl/10">
            <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-gold to-champagne" />
          </div>
        </div>
        <p className="max-w-xs text-sm font-light leading-relaxed text-mist">
          1 credit ≈ 1 minute of source footage. Unused monthly credits roll over for 30 days.
        </p>
      </div>

      {/* Plans */}
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div key={plan.name} className={`price-ring ${plan.name === 'Clipper' ? 'feat' : ''}`}>
            {plan.current && (
              <span className="absolute right-5 top-5 rounded-full border border-hair px-3 py-1 text-[10px] uppercase tracking-widest text-champagne">
                Current
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
            {plan.current ? (
              <button disabled className="btn-lux btn-outline w-full opacity-50">Current plan</button>
            ) : (
              <button
                onClick={() => upgrade(plan.name.toLowerCase())}
                disabled={loading !== null}
                className={`btn-lux w-full ${plan.name === 'Clipper' ? 'btn-gold' : 'btn-outline'} disabled:opacity-60`}
              >
                {loading === plan.name.toLowerCase() ? 'Redirecting…' : `Upgrade to ${plan.name}`}
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm font-light text-mist">
        Need invoice history or a custom tier?{' '}
        <a href="mailto:billing@NOLOGY.app" className="text-gold underline underline-offset-4">Contact billing</a>
      </p>
    </div>
  )
}
