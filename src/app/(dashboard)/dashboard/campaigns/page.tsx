'use client'

import { useState } from 'react'
import { Megaphone, Plus, TrendingUp, Eye, DollarSign } from 'lucide-react'

const CAMPAIGNS = [
  {
    name: 'Whop Content Rewards — Q3',
    posts: 18,
    views: 412_000,
    payout: 1_840,
    per1k: 4.46,
    status: 'Active',
  },
  {
    name: 'Brand X ambassador program',
    posts: 7,
    views: 156_000,
    payout: 620,
    per1k: 3.97,
    status: 'Active',
  },
  {
    name: 'Affiliate — editing tools',
    posts: 11,
    views: 98_000,
    payout: 215,
    per1k: 2.19,
    status: 'Paused',
  },
]

export default function CampaignsPage() {
  const [creating, setCreating] = useState(false)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">The books</p>
          <h1 className="display-md mt-2.5">Campaigns</h1>
        </div>
        <button onClick={() => setCreating(true)} className="btn-lux btn-gold !py-3">
          <Plus className="h-4 w-4" />
          New campaign
        </button>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {CAMPAIGNS.map((c) => (
          <article key={c.name} className="glass-card rv in transition-transform duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between gap-3">
              <span className="icon-gem !mb-0 !h-10 !w-10 !rounded-xl">
                <Megaphone className="h-4 w-4" />
              </span>
              <span
                className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-widest ${
                  c.status === 'Active'
                    ? 'bg-emerald-deep/30 text-emerald-300'
                    : 'bg-pearl/5 text-mist'
                }`}
              >
                {c.status}
              </span>
            </div>

            <h3 className="mt-4 font-display text-xl font-semibold leading-snug">{c.name}</h3>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3.5 text-sm">
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-light text-mist"><Eye className="h-3.5 w-3.5" /> Views</dt>
                <dd className="mt-0.5 font-medium">{c.views.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-light text-mist"><DollarSign className="h-3.5 w-3.5" /> Payout</dt>
                <dd className="mt-0.5 font-medium text-gold">${c.payout.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-light text-mist"><TrendingUp className="h-3.5 w-3.5" /> $ / 1K</dt>
                <dd className="mt-0.5 font-medium">${c.per1k.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-xs font-light text-mist">Posts</dt>
                <dd className="mt-0.5 font-medium">{c.posts}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      {/* Create modal (simple inline) */}
      {creating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-onyx/80 px-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setCreating(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-hair bg-onyx-2 p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-champagne">New campaign</p>
            <h2 className="display-md mt-2.5">Name the ledger</h2>
            <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); setCreating(false) }}>
              <input required placeholder="Campaign name" className="input-lux" />
              <select className="input-lux" defaultValue="">
                <option value="" disabled>Program type</option>
                <option>Content Rewards</option>
                <option>Affiliate</option>
                <option>Ambassador</option>
              </select>
              <button type="submit" className="btn-lux btn-gold w-full">Create campaign</button>
              <button type="button" onClick={() => setCreating(false)} className="btn-lux btn-ghost w-full">
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
