'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, AlertTriangle, ChevronLeft, ChevronRight, Check, Banknote, Download } from 'lucide-react'

type PayoutRow = {
  id: string
  amount: string | number
  status: string
  notes?: string | null
  periodEnd: string
  createdAt: string
  user: { id: string; email: string; name?: string | null }
  campaign?: { name: string } | null
  clip?: { title: string; projectId: string } | null
}

const STATUSES = ['PENDING', 'APPROVED', 'PAID']
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-champagne/15 text-champagne',
  APPROVED: 'bg-sky-400/15 text-sky-300',
  PAID: 'bg-emerald-deep/30 text-emerald-300',
}

export default function AdminPayoutsPage() {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [debouncedQ, setDebouncedQ] = useState('')
  const [confirming, setConfirming] = useState<{ payout: PayoutRow; to: 'APPROVED' | 'PAID' } | null>(null)

  useMemo(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [q])

  const query = useQuery({
    queryKey: ['admin-payouts', debouncedQ, status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '25' })
      if (debouncedQ) params.set('q', debouncedQ)
      if (status) params.set('status', status)
      const res = await fetch(`/api/admin/payouts?${params}`)
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{ payouts: PayoutRow[]; pagination: { page: number; totalPages: number } }>
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, to }: { id: string; to: 'APPROVED' | 'PAID' }) => {
      const res = await fetch(`/api/admin/payouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }))
        throw new Error(err.error ?? 'Failed')
      }
      return res.json()
    },
    onSuccess: (_data, vars) => {
      toast.success(`Payout ${vars.to === 'PAID' ? 'marked paid' : 'approved'}`)
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] })
      setConfirming(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const payouts = query.data?.payouts ?? []

  const exportCsv = () => {
    const rows = [['id', 'user', 'amount', 'status', 'campaign', 'clip', 'periodEnd', 'createdAt']]
    payouts.forEach((p) => {
      rows.push([p.id, p.user.email, String(p.amount), p.status, p.campaign?.name ?? '', p.clip?.title ?? '', p.periodEnd, p.createdAt])
    })
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'payouts.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Creator earnings</p>
          <h1 className="display-md mt-2.5">Payouts</h1>
        </div>
        <button onClick={exportCsv} disabled={payouts.length === 0} className="btn-lux flex items-center gap-2 border border-hair/50 text-mist hover:text-pearl">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by user email…"
            className="input-lux !pl-10"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="input-lux w-auto">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {query.isError && (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> Couldn&apos;t load payouts.
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-hair/50 bg-onyx-2/50 backdrop-blur-sm">
        <div className="hidden grid-cols-[1fr_90px_100px_110px_130px] gap-4 border-b border-hair/30 px-6 py-3.5 text-xs uppercase tracking-widest text-mist-2 md:grid">
          <span>Creator · context</span>
          <span className="text-center">Amount</span>
          <span className="text-center">Status</span>
          <span className="text-right">Period end</span>
          <span className="text-right">Actions</span>
        </div>

        {query.isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={`sk-${i}`} className={`px-6 py-4 ${i > 0 ? 'border-t border-hair/30' : ''}`}>
                <div className="h-4 w-full animate-pulse rounded bg-surface" />
              </div>
            ))
          : payouts.map((p, i) => (
              <div
                key={p.id}
                className={`grid grid-cols-2 items-center gap-4 px-6 py-4 transition-colors md:grid-cols-[1fr_90px_100px_110px_130px] ${
                  i > 0 ? 'border-t border-hair/30' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.user.name ?? p.user.email}</p>
                  <p className="truncate text-xs text-mist">
                    {p.campaign?.name ?? 'Direct'} · {p.clip?.title ?? ''}
                  </p>
                </div>
                <span className="text-center font-semibold text-gold">${Number(p.amount).toFixed(2)}</span>
                <span className={`mx-auto rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest ${STATUS_COLOR[p.status] ?? 'bg-pearl/10 text-mist'}`}>
                  {p.status}
                </span>
                <span className="text-right text-xs font-light text-mist">
                  {new Date(p.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <div className="flex justify-end gap-2">
                  {p.status === 'PENDING' && (
                    <button
                      onClick={() => setConfirming({ payout: p, to: 'APPROVED' })}
                      className="btn-lux border border-sky-400/40 px-3 py-1.5 text-xs text-sky-300 hover:bg-sky-400/10"
                    >
                      Approve
                    </button>
                  )}
                  {p.status !== 'PAID' && (
                    <button
                      onClick={() => setConfirming({ payout: p, to: 'PAID' })}
                      className="btn-lux btn-gold items-center gap-1 px-3 py-1.5 text-xs"
                    >
                      <Check className="h-3 w-3" /> Pay
                    </button>
                  )}
                </div>
              </div>
            ))}
      </div>

      {payouts.length === 0 && !query.isLoading && (
        <p className="mt-8 rounded-2xl border border-dashed border-hair/50 px-6 py-12 text-center text-sm font-light text-mist">
          No payouts match your filters.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-mist">
        <span>Page {query.data?.pagination.page ?? 1} of {Math.max(1, query.data?.pagination.totalPages ?? 1)}</span>
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
            disabled={page >= (query.data?.pagination.totalPages ?? 1)}
            className="flex items-center gap-1 rounded-lg border border-hair/50 px-2.5 py-1.5 disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setConfirming(null)}>
          <div className="w-full max-w-md rounded-2xl border border-hair/50 bg-onyx-2 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <Banknote className="h-8 w-8 text-gold" />
            <h3 className="mt-3 font-display text-xl font-semibold">
              {confirming.to === 'PAID' ? 'Mark this payout as paid?' : 'Approve this payout?'}
            </h3>
            <p className="mt-2 text-sm font-light text-mist">
              {confirming.payout.user.name ?? confirming.payout.user.email} ·{' '}
              <span className="font-semibold text-gold">${Number(confirming.payout.amount).toFixed(2)}</span>
              {confirming.payout.campaign?.name && <> · {confirming.payout.campaign.name}</>}
            </p>
            <p className="mt-1 text-xs font-light text-mist-2">
              This is a bookkeeping action — settle the transfer in your actual payout provider.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirming(null)} className="btn-lux flex-1 border border-hair/50 text-mist hover:text-pearl">
                Cancel
              </button>
              <button
                onClick={() => updateMutation.mutate({ id: confirming.payout.id, to: confirming.to })}
                disabled={updateMutation.isPending}
                className={`btn-lux flex-1 ${confirming.to === 'PAID' ? 'btn-gold' : 'border border-sky-400/40 !text-sky-300'}`}
              >
                {updateMutation.isPending ? 'Saving…' : confirming.to === 'PAID' ? 'Confirm paid' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}