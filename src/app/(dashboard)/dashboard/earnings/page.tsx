'use client'

import { useQuery } from '@tanstack/react-query'
import { TrendingUp, DollarSign, Clock, Download, Loader2, AlertTriangle } from 'lucide-react'

type Payout = {
  id: string
  amount: string | number
  status: 'PENDING' | 'APPROVED' | 'PAID'
  periodStart: string
  periodEnd: string
  createdAt: string
  campaign?: { id: string; name: string } | null
  clip?: { id: string; title: string } | null
}

const STATUS_LABEL: Record<Payout['status'], string> = {
  PAID: 'Paid',
  APPROVED: 'Approved',
  PENDING: 'Pending',
}

const STATUS_STYLE: Record<Payout['status'], string> = {
  PAID: 'bg-emerald-deep/30 text-emerald-300',
  APPROVED: 'bg-champagne/15 text-champagne',
  PENDING: 'bg-pearl/5 text-mist',
}

function num(v: string | number) {
  return Number(v) || 0
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function EarningsPage() {
  const payoutsQuery = useQuery({
    queryKey: ['payouts'],
    queryFn: async () => {
      const res = await fetch('/api/payouts?limit=50')
      if (!res.ok) throw new Error('Failed to load payouts')
      return res.json() as Promise<{ payouts: Payout[] }>
    },
  })

  const payouts = payoutsQuery.data?.payouts ?? []
  const paid = payouts.filter((p) => p.status === 'PAID')
  const pending = payouts.filter((p) => p.status === 'PENDING')
  const approved = payouts.filter((p) => p.status === 'APPROVED')

  const summary = [
    { label: 'Total earned', value: paid.reduce((a, p) => a + num(p.amount), 0), icon: DollarSign },
    { label: 'Pending approval', value: pending.reduce((a, p) => a + num(p.amount), 0), icon: Clock },
    { label: 'Approved', value: approved.reduce((a, p) => a + num(p.amount), 0), icon: TrendingUp },
  ]

  const exportCsv = () => {
    const rows = [
      ['Campaign', 'Amount', 'Status', 'Period start', 'Period end'],
      ...payouts.map((p) => [
        p.campaign?.name ?? p.clip?.title ?? 'Manual entry',
        num(p.amount).toFixed(2),
        STATUS_LABEL[p.status],
        p.periodStart,
        p.periodEnd,
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `nology-payouts-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">The score</p>
          <h1 className="display-md mt-2.5">Earnings</h1>
        </div>
        <button onClick={exportCsv} disabled={payouts.length === 0} className="btn-lux btn-outline !py-3 disabled:opacity-50">
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {payoutsQuery.isError && (
        <p className="mt-8 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> Couldn&apos;t load your earnings. Please try again.
        </p>
      )}

      {/* Summary */}
      {payoutsQuery.isLoading ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card !p-7">
              <div className="h-5 w-5 animate-pulse rounded bg-surface" />
              <div className="mt-5 h-9 w-24 animate-pulse rounded bg-surface" />
              <div className="mt-2 h-3 w-28 animate-pulse rounded bg-surface" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {summary.map((s) => (
            <div key={s.label} className="glass-card !p-7">
              <s.icon className="h-5 w-5 text-gold" />
              <p className="mt-5 font-display text-4xl font-semibold">${s.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              <p className="mt-1 text-sm font-light text-mist">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Ledger */}
      <div className="mt-14">
        <h2 className="mb-5 font-display text-2xl font-semibold">Payout ledger</h2>
        {!payoutsQuery.isLoading && !payoutsQuery.isError && payouts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-hair/50 px-6 py-16 text-center text-sm font-light text-mist">
            No payouts yet — link clips to campaigns and log your earnings as they come in.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-hair/50 bg-onyx-2/50 backdrop-blur-sm">
            <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-6 border-b border-hair/30 px-6 py-3.5 text-xs uppercase tracking-widest text-mist-2 sm:grid">
              <span>Campaign</span>
              <span className="w-24 text-right">Amount</span>
              <span className="w-28 text-center">Status</span>
              <span className="w-16 text-right">Date</span>
            </div>
            {(payoutsQuery.isLoading ? Array.from({ length: 4 }) : payouts).map((raw, i) => {
              if (payoutsQuery.isLoading) {
                return (
                  <div key={`skeleton-${i}`} className={`px-6 py-4 ${i > 0 ? 'border-t border-hair/30' : ''}`}>
                    <div className="h-4 w-full animate-pulse rounded bg-surface" />
                  </div>
                )
              }
              const p = raw as Payout
              return (
                <div
                  key={p.id}
                  className={`grid grid-cols-2 gap-4 px-6 py-4 transition-colors hover:bg-surface sm:grid-cols-[1fr_auto_auto_auto] sm:gap-6 ${
                    i > 0 ? 'border-t border-hair/30' : ''
                  }`}
                >
                  <span className="truncate font-light">{p.campaign?.name ?? p.clip?.title ?? 'Manual entry'}</span>
                  <span className="text-right font-medium text-gold sm:w-24">
                    ${num(p.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  <span className={`justify-self-end rounded-full px-3 py-1 text-[10px] uppercase tracking-widest sm:w-28 sm:text-center ${STATUS_STYLE[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                  <span className="text-right text-sm font-light text-mist sm:w-16">{fmtDate(p.periodEnd)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
