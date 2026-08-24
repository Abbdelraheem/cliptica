'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Plus, TrendingUp, Eye, DollarSign, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

type Campaign = {
  id: string
  name: string
  type: 'WHOP_CONTENT_REWARDS' | 'BRAND_DEAL' | 'OWN_CHANNEL'
  ratePer1k: string | number
  isActive: boolean
  _count: { clips: number }
  clips: { views: number; estEarnings: string | number }[]
}

const TYPE_LABEL: Record<Campaign['type'], string> = {
  WHOP_CONTENT_REWARDS: 'Content Rewards',
  BRAND_DEAL: 'Brand deal',
  OWN_CHANNEL: 'Own channel',
}

function num(v: string | number) {
  return Number(v) || 0
}

export default function CampaignsPage() {
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)

  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/campaigns')
      if (!res.ok) throw new Error('Failed to load campaigns')
      return res.json() as Promise<{ campaigns: Campaign[] }>
    },
  })

  const createCampaign = useMutation({
    mutationFn: async (input: { name: string; type: Campaign['type']; ratePer1k: number }) => {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to create campaign')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      setCreating(false)
      toast.success('Campaign created')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const campaigns = campaignsQuery.data?.campaigns ?? []

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

      {campaignsQuery.isError && (
        <p className="mt-8 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> Couldn&apos;t load your campaigns. Please try again.
        </p>
      )}

      {campaignsQuery.isLoading ? (
        <div className="mt-10 flex items-center justify-center gap-3 py-24 text-mist">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-light">Loading your campaigns…</span>
        </div>
      ) : !campaignsQuery.isError && campaigns.length === 0 ? (
        <button
          onClick={() => setCreating(true)}
          className="mt-10 block w-full cursor-pointer rounded-2xl border border-dashed border-hair/50 px-6 py-16 text-center text-sm font-light text-mist transition-colors hover:border-champagne hover:text-gold"
        >
          No campaigns yet — create your first one to start tracking views and payouts.
        </button>
      ) : (
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {campaigns.map((c) => {
            const views = c.clips.reduce((a, l) => a + l.views, 0)
            const payout = c.clips.reduce((a, l) => a + num(l.estEarnings), 0)
            const per1k = views > 0 ? payout / (views / 1000) : num(c.ratePer1k)
            return (
              <article key={c.id} className="glass-card rv in transition-transform duration-300 hover:-translate-y-1">
                <div className="flex items-start justify-between gap-3">
                  <span className="icon-gem !mb-0 !h-10 !w-10 !rounded-xl">
                    <Megaphone className="h-4 w-4" />
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-widest ${
                      c.isActive ? 'bg-emerald-deep/30 text-emerald-300' : 'bg-pearl/5 text-mist'
                    }`}
                  >
                    {c.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>

                <h3 className="mt-4 font-display text-xl font-semibold leading-snug">{c.name}</h3>
                <p className="mt-0.5 text-xs font-light text-mist">{TYPE_LABEL[c.type]}</p>

                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3.5 text-sm">
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-light text-mist"><Eye className="h-3.5 w-3.5" /> Views</dt>
                    <dd className="mt-0.5 font-medium">{views.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-light text-mist"><DollarSign className="h-3.5 w-3.5" /> Earnings</dt>
                    <dd className="mt-0.5 font-medium text-gold">${payout.toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-light text-mist"><TrendingUp className="h-3.5 w-3.5" /> $ / 1K</dt>
                    <dd className="mt-0.5 font-medium">${per1k.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-light text-mist">Posts</dt>
                    <dd className="mt-0.5 font-medium">{c._count.clips}</dd>
                  </div>
                </dl>
              </article>
            )
          })}
        </div>
      )}

      {/* Create modal */}
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
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                const form = new FormData(e.currentTarget)
                createCampaign.mutate({
                  name: String(form.get('name') ?? '').trim(),
                  type: String(form.get('type')) as Campaign['type'],
                  ratePer1k: Number(form.get('ratePer1k')),
                })
              }}
            >
              <input required name="name" maxLength={100} placeholder="Campaign name" className="input-lux" />
              <select name="type" className="input-lux" defaultValue="WHOP_CONTENT_REWARDS">
                <option value="WHOP_CONTENT_REWARDS">Content Rewards</option>
                <option value="BRAND_DEAL">Brand deal</option>
                <option value="OWN_CHANNEL">Own channel</option>
              </select>
              <input
                required
                name="ratePer1k"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Rate per 1K views ($)"
                className="input-lux"
              />
              <button type="submit" disabled={createCampaign.isPending} className="btn-lux btn-gold w-full disabled:opacity-60">
                {createCampaign.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                  </>
                ) : (
                  'Create campaign'
                )}
              </button>
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
