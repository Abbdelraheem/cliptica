'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Webhook,
  CreditCard,
  Users,
  ShoppingCart,
  Mail,
  Copy,
  Check,
  TrendingDown,
  UserCheck,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'

type LedgerRow = {
  id: string
  amount: number
  type: string
  description: string
  createdAt: string
  user: { id: string; email: string; name?: string | null }
}

type PaymentsData = {
  transactions: LedgerRow[]
  pagination: { page: number; total: number; totalPages: number }
  summary: { activeSubscriptions: number; webhooksTotal: number; webhooksToday: number }
  recentWebhooks: { stripeEventId: string; processedAt: string }[]
}

type CheckoutSessionRow = {
  id: string
  userId: string
  userEmail: string
  userName: string | null
  itemType: string
  itemId: string
  itemName: string
  amount: number | null
  currency: string
  status: 'INITIATED' | 'ABANDONED' | 'COMPLETED'
  createdAt: string
  updatedAt: string
  completedAt: string | null
  user?: { id: string; email: string; name: string | null; credits: number; role: string }
}

type TrackingData = {
  sessions: CheckoutSessionRow[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  metrics: {
    total: number
    initiated: number
    abandoned: number
    completed: number
    lostRevenue: number
    conversionRate: number
    abandonmentRate: number
  }
  abandonedEmails: string[]
}

const TYPES = ['purchase', 'usage', 'refund', 'bonus']
const TYPE_COLOR: Record<string, string> = {
  purchase: 'bg-emerald-deep/30 text-emerald-300',
  usage: 'bg-red-400/15 text-red-300',
  refund: 'bg-champagne/15 text-champagne',
  bonus: 'bg-sky-400/15 text-sky-300',
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  ABANDONED: { label: 'Abandoned', class: 'bg-red-500/15 text-red-300 border border-red-500/30' },
  INITIATED: { label: 'In Checkout', class: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' },
  COMPLETED: { label: 'Completed', class: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
}

export default function AdminPaymentsPage() {
  const [activeTab, setActiveTab] = useState<'tracking' | 'ledger'>('tracking')

  // Ledger state
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [debouncedQ, setDebouncedQ] = useState('')

  // Checkout Tracking state
  const [trackQ, setTrackQ] = useState('')
  const [trackStatus, setTrackStatus] = useState<'all' | 'ABANDONED' | 'INITIATED' | 'COMPLETED'>('all')
  const [trackPage, setTrackPage] = useState(1)
  const [debouncedTrackQ, setDebouncedTrackQ] = useState('')
  const [copiedEmails, setCopiedEmails] = useState(false)
  const [copiedEmailItem, setCopiedEmailItem] = useState<string | null>(null)

  useMemo(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [q])

  useMemo(() => {
    const t = setTimeout(() => {
      setDebouncedTrackQ(trackQ)
      setTrackPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [trackQ])

  // Query for ledger
  const query = useQuery({
    queryKey: ['admin-payments', debouncedQ, type, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '25' })
      if (debouncedQ) params.set('q', debouncedQ)
      if (type) params.set('type', type)
      const res = await fetch(`/api/admin/payments?${params}`)
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<PaymentsData>
    },
    enabled: activeTab === 'ledger',
  })

  // Query for checkout tracking
  const trackingQuery = useQuery({
    queryKey: ['admin-checkout-tracking', debouncedTrackQ, trackStatus, trackPage],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(trackPage), limit: '25' })
      if (debouncedTrackQ) params.set('q', debouncedTrackQ)
      if (trackStatus !== 'all') params.set('status', trackStatus)
      const res = await fetch(`/api/admin/checkout-tracking?${params}`)
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<TrackingData>
    },
    enabled: activeTab === 'tracking',
    refetchInterval: 15000, // Real-time poll every 15s
  })

  const data = query.data
  const trackData = trackingQuery.data

  function handleCopyAllAbandoned() {
    if (!trackData?.abandonedEmails || trackData.abandonedEmails.length === 0) return
    const text = trackData.abandonedEmails.join(', ')
    navigator.clipboard.writeText(text)
    setCopiedEmails(true)
    setTimeout(() => setCopiedEmails(false), 2500)
  }

  function handleCopySingleEmail(email: string) {
    navigator.clipboard.writeText(email)
    setCopiedEmailItem(email)
    setTimeout(() => setCopiedEmailItem(null), 2000)
  }

  function getMailtoLink(session: CheckoutSessionRow) {
    const name = session.userName || 'Creator'
    const plan = session.itemName
    const subject = encodeURIComponent(`Exclusive 15% discount for your Clipzila ${plan}`)
    const body = encodeURIComponent(
      `Hi ${name},\n\n` +
      `We noticed you started checking out the ${plan} on Clipzila, but didn't get to finish.\n\n` +
      `Did you run into any technical questions or need help setting up your podcast/video workflow?\n\n` +
      `Reply to this email or use promo code RECOVER15 at checkout for an extra 15% off your first month.\n\n` +
      `Best regards,\n` +
      `Dr. Abdelraheem & The Clipzila Team\n` +
      `https://clipzila.com`
    )
    return `mailto:${session.userEmail}?subject=${subject}&body=${body}`
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Revenue & Funnel</p>
          <h1 className="display-md mt-2">Payments & Checkout Funnel</h1>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center rounded-xl border border-hair/60 bg-onyx-2/90 p-1 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('tracking')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'tracking'
                ? 'bg-forge text-white shadow-lg shadow-forge/20'
                : 'text-mist hover:text-pearl'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            Checkout Tracking & Abandoned ({trackData?.metrics.abandoned ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'ledger'
                ? 'bg-forge text-white shadow-lg shadow-forge/20'
                : 'text-mist hover:text-pearl'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Ledger & Webhooks
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: CHECKOUT TRACKING & ABANDONED CARTS */}
      {/* ========================================================= */}
      {activeTab === 'tracking' && (
        <div className="mt-8 space-y-8">
          {/* Funnel KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass-card !p-5">
              <div className="flex items-center justify-between">
                <ShoppingCart className="h-5 w-5 text-forge" />
                <span className="font-display text-2xl font-semibold">
                  {trackData?.metrics.total ?? '—'}
                </span>
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-mist-2">
                Total Checkouts Initiated
              </p>
            </div>

            <div className="glass-card !p-5 border-red-500/20 bg-red-950/10">
              <div className="flex items-center justify-between">
                <TrendingDown className="h-5 w-5 text-red-400" />
                <div className="text-right">
                  <span className="font-display text-2xl font-semibold text-red-300">
                    {trackData?.metrics.abandoned ?? '—'}
                  </span>
                  <span className="ml-2 text-xs font-medium text-red-400">
                    ({trackData?.metrics.abandonmentRate ?? 0}%)
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-red-300/80">
                Abandoned (Lost Carts)
              </p>
            </div>

            <div className="glass-card !p-5 border-amber-500/20 bg-amber-950/10">
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg font-bold text-amber-400">$</span>
                <span className="font-display text-2xl font-semibold text-amber-300">
                  ${(trackData?.metrics.lostRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                </span>
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-amber-300/80">
                Potential Lost Revenue
              </p>
            </div>

            <div className="glass-card !p-5 border-emerald-500/20 bg-emerald-950/10">
              <div className="flex items-center justify-between">
                <UserCheck className="h-5 w-5 text-emerald-400" />
                <div className="text-right">
                  <span className="font-display text-2xl font-semibold text-emerald-300">
                    {trackData?.metrics.completed ?? '—'}
                  </span>
                  <span className="ml-2 text-xs font-medium text-emerald-400">
                    ({trackData?.metrics.conversionRate ?? 0}%)
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-emerald-300/80">
                Completed & Converted
              </p>
            </div>
          </div>

          {/* Filters & Export Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-2" />
                <input
                  value={trackQ}
                  onChange={(e) => setTrackQ(e.target.value)}
                  placeholder="Search customer email, name, or plan…"
                  className="input-lux !pl-10"
                />
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-1 rounded-xl border border-hair/50 bg-onyx-2/60 p-1">
                {(['all', 'ABANDONED', 'INITIATED', 'COMPLETED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setTrackStatus(st)
                      setTrackPage(1)
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                      trackStatus === st
                        ? 'bg-pearl/15 text-pearl shadow-sm'
                        : 'text-mist hover:text-pearl'
                    }`}
                  >
                    {st === 'all' ? 'All Statuses' : st.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Mass Retarget Export */}
            <button
              onClick={handleCopyAllAbandoned}
              disabled={!trackData?.abandonedEmails?.length}
              className="btn-lux flex items-center gap-2 !py-2 text-xs font-semibold disabled:opacity-40"
            >
              {copiedEmails ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  Copied {trackData?.abandonedEmails?.length} Emails!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-forge" />
                  Copy {trackData?.abandonedEmails?.length ?? 0} Abandoned Emails
                </>
              )}
            </button>
          </div>

          {/* Tracking Table */}
          <div className="overflow-hidden rounded-2xl border border-hair/50 bg-onyx-2/50 backdrop-blur-sm">
            <div className="hidden grid-cols-[1.5fr_1fr_100px_140px_160px_160px] gap-4 border-b border-hair/30 px-6 py-3.5 text-xs uppercase tracking-widest text-mist-2 md:grid">
              <span>Customer</span>
              <span>Item Attempted</span>
              <span className="text-center">Price</span>
              <span className="text-center">Status</span>
              <span>Time</span>
              <span className="text-right">Actions</span>
            </div>

            {trackingQuery.isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={`sk-tr-${i}`} className={`px-6 py-4 ${i > 0 ? 'border-t border-hair/30' : ''}`}>
                  <div className="h-4 w-full animate-pulse rounded bg-surface" />
                </div>
              ))
            ) : (trackData?.sessions ?? []).length === 0 ? (
              <div className="px-6 py-16 text-center">
                <ShoppingCart className="mx-auto h-8 w-8 text-mist-2 opacity-50" />
                <p className="mt-3 text-sm font-medium text-pearl">No checkout sessions found</p>
                <p className="mt-1 text-xs text-mist">
                  When users open Paddle checkout on the billing page, their sessions and status will be tracked here live.
                </p>
              </div>
            ) : (
              (trackData?.sessions ?? []).map((s, i) => {
                const badge = STATUS_BADGE[s.status] || STATUS_BADGE.INITIATED
                return (
                  <div
                    key={s.id}
                    className={`grid grid-cols-1 items-center gap-4 px-6 py-4 transition-colors md:grid-cols-[1.5fr_1fr_100px_140px_160px_160px] ${
                      i > 0 ? 'border-t border-hair/30' : ''
                    } hover:bg-surface/30`}
                  >
                    {/* Customer */}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-pearl">
                        {s.userName || 'Clipzila User'}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs text-mist">{s.userEmail}</span>
                        <button
                          onClick={() => handleCopySingleEmail(s.userEmail)}
                          title="Copy Email"
                          className="text-mist-2 hover:text-pearl"
                        >
                          {copiedEmailItem === s.userEmail ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Item */}
                    <div className="min-w-0">
                      <span className="rounded-md border border-hair/60 bg-surface/50 px-2 py-1 text-xs font-semibold text-pearl">
                        {s.itemName}
                      </span>
                    </div>

                    {/* Price */}
                    <span className="text-center font-mono text-sm font-semibold text-pearl">
                      {s.amount !== null ? `$${s.amount}` : '—'}
                    </span>

                    {/* Status */}
                    <div className="flex justify-center">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${badge.class}`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Time */}
                    <span className="text-xs font-light text-mist">
                      {new Date(s.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={getMailtoLink(s)}
                        title="Send recovery email via mailto"
                        className="flex items-center gap-1 rounded-lg border border-forge/40 bg-forge/10 px-2.5 py-1 text-xs font-medium text-forge transition-all hover:bg-forge hover:text-white"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Target Email
                      </a>

                      <Link
                        href={`/admin/users?q=${encodeURIComponent(s.userEmail)}`}
                        title="View user details in Admin"
                        className="rounded-lg border border-hair/50 p-1.5 text-mist hover:bg-surface hover:text-pearl"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-mist">
            <span>
              Page {trackData?.pagination.page ?? 1} of {Math.max(1, trackData?.pagination.totalPages ?? 1)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setTrackPage((p) => p - 1)}
                disabled={trackPage <= 1}
                className="flex items-center gap-1 rounded-lg border border-hair/50 px-2.5 py-1.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                onClick={() => setTrackPage((p) => p + 1)}
                disabled={trackPage >= (trackData?.pagination.totalPages ?? 1)}
                className="flex items-center gap-1 rounded-lg border border-hair/50 px-2.5 py-1.5 disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: LEDGER & WEBHOOKS (ORIGINAL LEDGER VIEW) */}
      {/* ========================================================= */}
      {activeTab === 'ledger' && (
        <div className="mt-8 space-y-8">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                label: 'Active subscriptions',
                value: data?.summary.activeSubscriptions ?? '—',
                icon: Users,
              },
              {
                label: `Webhooks today / total`,
                value: data ? `${data.summary.webhooksToday} / ${data.summary.webhooksTotal}` : '—',
                icon: Webhook,
              },
              {
                label: 'Ledger entries',
                value: data?.pagination.total ?? '—',
                icon: CreditCard,
              },
            ].map((s) => (
              <div key={s.label} className="glass-card !p-5">
                <div className="flex items-center justify-between">
                  <s.icon className="h-5 w-5 text-gold" />
                  <span className="font-display text-2xl font-semibold">{s.value}</span>
                </div>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-mist-2">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search description or email…"
                className="input-lux !pl-10"
              />
            </div>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                setPage(1)
              }}
              className="input-lux w-auto"
            >
              <option value="">All types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {query.isError && (
            <p className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4" /> Couldn&apos;t load payments.
            </p>
          )}

          {/* Ledger */}
          <div className="overflow-hidden rounded-2xl border border-hair/50 bg-onyx-2/50 backdrop-blur-sm">
            <div className="hidden grid-cols-[1fr_90px_110px_160px] gap-4 border-b border-hair/30 px-6 py-3.5 text-xs uppercase tracking-widest text-mist-2 md:grid">
              <span>Description</span>
              <span className="text-center">Amount</span>
              <span className="text-center">Type</span>
              <span className="text-right">When</span>
            </div>

            {query.isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={`sk-${i}`} className={`px-6 py-4 ${i > 0 ? 'border-t border-hair/30' : ''}`}>
                    <div className="h-4 w-full animate-pulse rounded bg-surface" />
                  </div>
                ))
              : (data?.transactions ?? []).map((t, i) => (
                  <div
                    key={t.id}
                    className={`grid grid-cols-2 items-center gap-4 px-6 py-4 transition-colors md:grid-cols-[1fr_90px_110px_160px] ${
                      i > 0 ? 'border-t border-hair/30' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.description}</p>
                      <p className="truncate text-xs text-mist">{t.user.email}</p>
                    </div>
                    <span
                      className={`text-center text-sm font-semibold ${
                        t.amount >= 0 ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      {t.amount >= 0 ? `+${t.amount}` : t.amount}
                    </span>
                    <span
                      className={`mx-auto rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest ${
                        TYPE_COLOR[t.type] ?? 'bg-pearl/10 text-mist'
                      }`}
                    >
                      {t.type}
                    </span>
                    <span className="text-right text-xs font-light text-mist">
                      {new Date(t.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
          </div>

          {data && data.transactions.length === 0 && !query.isLoading && (
            <p className="rounded-2xl border border-dashed border-hair/50 px-6 py-12 text-center text-sm font-light text-mist">
              No transactions match your filters.
            </p>
          )}

          <div className="flex items-center justify-between text-sm text-mist">
            <span>
              Page {data?.pagination.page ?? 1} of {Math.max(1, data?.pagination.totalPages ?? 1)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border border-hair/50 px-2.5 py-1.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (data?.pagination.totalPages ?? 1)}
                className="flex items-center gap-1 rounded-lg border border-hair/50 px-2.5 py-1.5 disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Recent webhooks */}
          <section className="glass-card !p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Webhook className="h-5 w-5 text-gold" /> Recent Payment webhooks
            </h2>
            <div className="mt-4 space-y-1">
              {data?.recentWebhooks.map((w) => (
                <div
                  key={w.stripeEventId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-surface"
                >
                  <span className="font-mono text-xs text-mist">{w.stripeEventId}</span>
                  <span className="text-xs font-light text-mist">
                    {new Date(w.processedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
              {(data?.recentWebhooks ?? []).length === 0 && !query.isLoading && (
                <p className="text-sm font-light text-mist">
                  No webhooks processed yet. (Live payment events will appear here.)
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}