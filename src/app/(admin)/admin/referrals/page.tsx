'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, Copy, Check, DollarSign,
  Users, MousePointerClick, Trash2, Clapperboard
} from 'lucide-react'

type AffiliateRow = {
  id: string
  name: string
  code: string
  email?: string | null
  commissionRate: number
  isActive: boolean
  notes?: string | null
  clicks: number
  signups: number
  firstProjects: number
  subscriptions: number
  totalRevenue: number
  totalCommission: number
  createdAt: string
}

type FunnelData = {
  clicks: number
  signups: number
  signupRate: number
  firstProjects: number
  projectDropoff: number
  subscriptions: number
  subscriptionRate: number
  totalRevenue: number
  totalCommission: number
}

export default function AdminReferralsPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [commissionRate, setCommissionRate] = useState('20')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  const affiliatesQuery = useQuery({
    queryKey: ['admin-affiliates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/affiliates')
      if (!res.ok) throw new Error('Failed to load referral data')
      return res.json() as Promise<{ affiliates: AffiliateRow[]; funnel: FunnelData }>
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code: code.trim().toLowerCase(),
          commissionRate: Number(commissionRate) || 20,
          email: email.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }))
        throw new Error(err.error ?? 'Failed to create affiliate link')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Influencer referral link created')
      queryClient.invalidateQueries({ queryKey: ['admin-affiliates'] })
      setModalOpen(false)
      setName('')
      setCode('')
      setEmail('')
      setNotes('')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create affiliate link'),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/affiliates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Status updated')
      queryClient.invalidateQueries({ queryKey: ['admin-affiliates'] })
    },
    onError: () => toast.error('Could not update status'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm('Are you sure you want to remove this referral link?')) return
      const res = await fetch(`/api/admin/affiliates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Referral link removed')
      queryClient.invalidateQueries({ queryKey: ['admin-affiliates'] })
    },
    onError: () => toast.error('Could not delete affiliate'),
  })

  function copyLink(affCode: string, id: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cliptica.com'
    const fullUrl = `${origin}/r/${affCode}`
    navigator.clipboard.writeText(fullUrl)
    setCopiedId(id)
    toast.success('Copied referral link: ' + fullUrl)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const affiliates = affiliatesQuery.data?.affiliates ?? []
  const funnel = affiliatesQuery.data?.funnel ?? {
    clicks: 0,
    signups: 0,
    signupRate: 0,
    firstProjects: 0,
    projectDropoff: 0,
    subscriptions: 0,
    subscriptionRate: 0,
    totalRevenue: 0,
    totalCommission: 0,
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Growth & Marketing</p>
          <h1 className="display-md mt-2.5 flex items-center gap-3">
            Referrals & Influencers
          </h1>
          <p className="mt-1 text-sm font-light text-mist">
            Track influencer campaigns, visitor conversions, sales revenue, and funnel drop-off points.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="btn-lux btn-gold flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> New Influencer Link
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-hair/60 bg-onyx-2/60 p-4">
          <p className="text-xs uppercase tracking-widest text-mist-2">Total Clicks</p>
          <p className="mt-2 font-display text-2xl font-bold text-pearl">{funnel.clicks}</p>
        </div>
        <div className="rounded-2xl border border-hair/60 bg-onyx-2/60 p-4">
          <p className="text-xs uppercase tracking-widest text-mist-2">Signups</p>
          <p className="mt-2 font-display text-2xl font-bold text-champagne">{funnel.signups}</p>
        </div>
        <div className="rounded-2xl border border-hair/60 bg-onyx-2/60 p-4">
          <p className="text-xs uppercase tracking-widest text-mist-2">First Project</p>
          <p className="mt-2 font-display text-2xl font-bold text-sky-400">{funnel.firstProjects}</p>
        </div>
        <div className="rounded-2xl border border-hair/60 bg-onyx-2/60 p-4">
          <p className="text-xs uppercase tracking-widest text-mist-2">Paid Subs</p>
          <p className="mt-2 font-display text-2xl font-bold text-emerald-400">{funnel.subscriptions}</p>
        </div>
        <div className="rounded-2xl border border-hair/60 bg-onyx-2/60 p-4">
          <p className="text-xs uppercase tracking-widest text-mist-2">Gross Revenue</p>
          <p className="mt-2 font-display text-2xl font-bold text-gold">${funnel.totalRevenue}</p>
        </div>
        <div className="rounded-2xl border border-hair/60 bg-onyx-2/60 p-4">
          <p className="text-xs uppercase tracking-widest text-mist-2">Commission Due</p>
          <p className="mt-2 font-display text-2xl font-bold text-amber-300">${funnel.totalCommission}</p>
        </div>
      </div>

      {/* Funnel & Drop-off Tracker (وين علقو المستخدم) */}
      <div className="rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.04] to-pearl/[0.01] p-6 backdrop-blur-xl sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-pearl">
              Conversion Funnel & Drop-off Analysis
            </h2>
            <p className="text-xs font-light text-mist">
              Inspect exactly where users drop off across the influencer acquisition pipeline.
            </p>
          </div>
          <span className="rounded-full border border-champagne/30 bg-champagne/10 px-3 py-1 text-xs text-champagne">
            Funnel Intelligence
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          {/* Stage 1 */}
          <div className="relative rounded-2xl border border-hair/60 bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-widest text-mist-2">Stage 1</span>
              <MousePointerClick className="h-4 w-4 text-mist" />
            </div>
            <p className="mt-2 text-sm font-medium text-pearl">Landing Visits</p>
            <p className="font-display text-2xl font-bold text-pearl">{funnel.clicks}</p>
            <p className="mt-1 text-xs text-mist-2">100% of incoming traffic</p>
          </div>

          {/* Stage 2 */}
          <div className="relative rounded-2xl border border-hair/60 bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-widest text-mist-2">Stage 2</span>
              <Users className="h-4 w-4 text-champagne" />
            </div>
            <p className="mt-2 text-sm font-medium text-pearl">Account Signups</p>
            <p className="font-display text-2xl font-bold text-champagne">{funnel.signups}</p>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-emerald-400">{funnel.signupRate}% converted</span>
              <span className="text-red-400/80">
                {funnel.clicks > 0 ? (100 - funnel.signupRate).toFixed(1) : 0}% left site
              </span>
            </div>
          </div>

          {/* Stage 3 */}
          <div className="relative rounded-2xl border border-hair/60 bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-widest text-mist-2">Stage 3</span>
              <Clapperboard className="h-4 w-4 text-sky-400" />
            </div>
            <p className="mt-2 text-sm font-medium text-pearl">First Project Created</p>
            <p className="font-display text-2xl font-bold text-sky-400">{funnel.firstProjects}</p>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-sky-300">
                {funnel.signups > 0 ? ((funnel.firstProjects / funnel.signups) * 100).toFixed(1) : 0}% created
              </span>
              <span className="text-amber-400/90" title="Users who registered but never pasted a video">
                {funnel.projectDropoff}% stuck here
              </span>
            </div>
          </div>

          {/* Stage 4 */}
          <div className="relative rounded-2xl border border-hair/60 bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-widest text-mist-2">Stage 4</span>
              <DollarSign className="h-4 w-4 text-gold" />
            </div>
            <p className="mt-2 text-sm font-medium text-pearl">Paid Subscriptions</p>
            <p className="font-display text-2xl font-bold text-gold">{funnel.subscriptions}</p>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-gold">{funnel.subscriptionRate}% customer rate</span>
              <span className="text-mist-2">
                ${funnel.totalRevenue} GMV
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Influencer Links Table */}
      <div className="overflow-hidden rounded-2xl border border-hair/50 bg-onyx-2/50 backdrop-blur-sm">
        <div className="border-b border-hair/40 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-pearl">Influencer Campaigns</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hair/30 bg-onyx-2 text-xs uppercase tracking-wider text-mist-2">
              <tr>
                <th className="px-6 py-3.5">Influencer / Code</th>
                <th className="px-6 py-3.5">Link</th>
                <th className="px-6 py-3.5 text-center">Comm. %</th>
                <th className="px-6 py-3.5 text-center">Clicks</th>
                <th className="px-6 py-3.5 text-center">Signups</th>
                <th className="px-6 py-3.5 text-center">Clips Run</th>
                <th className="px-6 py-3.5 text-center">Paid Subs</th>
                <th className="px-6 py-3.5 text-right">Revenue</th>
                <th className="px-6 py-3.5 text-right">Commission</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair/30">
              {affiliatesQuery.isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={11} className="px-6 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-surface" />
                    </td>
                  </tr>
                ))
              ) : affiliates.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-sm font-light text-mist">
                    No influencer links created yet. Click &quot;New Influencer Link&quot; above to create your first affiliate campaign!
                  </td>
                </tr>
              ) : (
                affiliates.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-surface/50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-pearl">{a.name}</p>
                      <p className="text-xs font-mono text-mist-2">/{a.code}</p>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => copyLink(a.code, a.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-hair/60 bg-black/40 px-2.5 py-1 text-xs text-champagne hover:border-gold hover:text-gold"
                      >
                        {copiedId === a.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>/r/{a.code}</span>
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-xs text-mist">{a.commissionRate}%</td>
                    <td className="px-6 py-4 text-center font-medium text-pearl">{a.clicks}</td>
                    <td className="px-6 py-4 text-center font-medium text-champagne">{a.signups}</td>
                    <td className="px-6 py-4 text-center font-light text-mist">{a.firstProjects}</td>
                    <td className="px-6 py-4 text-center font-medium text-emerald-400">{a.subscriptions}</td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-gold">${a.totalRevenue}</td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-amber-300">${a.totalCommission}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleMutation.mutate({ id: a.id, isActive: !a.isActive })}
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                          a.isActive
                            ? 'bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25'
                            : 'bg-red-400/15 text-red-300 hover:bg-red-400/25'
                        }`}
                      >
                        {a.isActive ? 'Active' : 'Paused'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => deleteMutation.mutate(a.id)}
                        className="rounded p-1.5 text-mist-2 transition-colors hover:text-red-400"
                        title="Delete affiliate"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Influencer Campaign */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-hair/50 bg-onyx-2 p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-semibold text-pearl">Create Influencer Link</h3>
            <p className="mt-1 text-xs text-mist">
              Generate a unique tracking link for a creator or influencer.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                createMutation.mutate()
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-mist-2">
                  Influencer Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (!code) {
                      setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                    }
                  }}
                  placeholder="e.g. Firas Tech"
                  className="input-lux"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-mist-2">
                  Link Slug (URL Code)
                </label>
                <div className="flex items-center rounded-xl border border-hair/60 bg-black/30 px-3">
                  <span className="font-mono text-xs text-mist-2">cliptica.com/r/</span>
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="firas"
                    className="flex-1 bg-transparent py-2.5 text-sm font-medium text-gold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-widest text-mist-2">
                    Commission Rate (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      className="input-lux pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-mist-2">%</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-widest text-mist-2">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="creator@youtube.com"
                    className="input-lux"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-mist-2">
                  Notes (Campaign details)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Paid sponsorship on TikTok + 20% recurring affiliate cut"
                  rows={2}
                  className="input-lux resize-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-lux btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name || !code || createMutation.isPending}
                  className="btn-lux btn-gold flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {createMutation.isPending ? 'Creating…' : 'Create Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
