'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, AlertTriangle, ChevronLeft, ChevronRight, Webhook, CreditCard, Users } from 'lucide-react'

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

const TYPES = ['purchase', 'usage', 'refund', 'bonus']
const TYPE_COLOR: Record<string, string> = {
  purchase: 'bg-emerald-deep/30 text-emerald-300',
  usage: 'bg-red-400/15 text-red-300',
  refund: 'bg-champagne/15 text-champagne',
  bonus: 'bg-sky-400/15 text-sky-300',
}

export default function AdminPaymentsPage() {
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [debouncedQ, setDebouncedQ] = useState('')

  useMemo(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [q])

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
  })

  const data = query.data

  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-champagne">Money</p>
        <h1 className="display-md mt-2.5">Payments</h1>
      </div>

      {/* Summary cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search description or email…"
            className="input-lux !pl-10"
          />
        </div>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1) }} className="input-lux w-auto">
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {query.isError && (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> Couldn&apos;t load payments.
        </p>
      )}

      {/* Ledger */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-hair/50 bg-onyx-2/50 backdrop-blur-sm">
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
                <span className={`text-center text-sm font-semibold ${t.amount >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {t.amount >= 0 ? `+${t.amount}` : t.amount}
                </span>
                <span className={`mx-auto rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest ${TYPE_COLOR[t.type] ?? 'bg-pearl/10 text-mist'}`}>
                  {t.type}
                </span>
                <span className="text-right text-xs font-light text-mist">
                  {new Date(t.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
      </div>

      {data && data.transactions.length === 0 && !query.isLoading && (
        <p className="mt-8 rounded-2xl border border-dashed border-hair/50 px-6 py-12 text-center text-sm font-light text-mist">
          No transactions match your filters.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-mist">
        <span>Page {data?.pagination.page ?? 1} of {Math.max(1, data?.pagination.totalPages ?? 1)}</span>
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
      <section className="mt-8 glass-card !p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Webhook className="h-5 w-5 text-gold" /> Recent Stripe webhooks
        </h2>
        <div className="mt-4 space-y-1">
          {data?.recentWebhooks.map((w) => (
            <div key={w.stripeEventId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-surface">
              <span className="font-mono text-xs text-mist">{w.stripeEventId}</span>
              <span className="text-xs font-light text-mist">
                {new Date(w.processedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          {(data?.recentWebhooks ?? []).length === 0 && !query.isLoading && (
            <p className="text-sm font-light text-mist">No webhooks processed yet. (Stripe live events will appear here.)</p>
          )}
        </div>
      </section>
    </div>
  )
}