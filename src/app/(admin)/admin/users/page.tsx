'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { toast } from 'sonner'
import { Search, Plus, Minus, AlertTriangle, ChevronLeft, ChevronRight, Coins } from 'lucide-react'

type UserRow = {
  id: string
  email: string
  name?: string | null
  role: string
  credits: number
  subscriptionStatus?: string | null
  emailVerified?: string | null
  createdAt: string
  _count: {
    projects: number
    clips: number
    payouts: number
    campaigns: number
    devices: number
    creditTransactions: number
  }
}

const ROLE_OPTIONS = ['FREE', 'CLIPPER', 'STUDIO', 'ADMIN']
const ROLE_COLOR: Record<string, string> = {
  ADMIN: 'bg-gold/20 text-gold',
  CLIPPER: 'bg-champagne/15 text-champagne',
  STUDIO: 'bg-sky-400/15 text-sky-300',
  FREE: 'bg-pearl/10 text-mist',
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (p: number) => void
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-mist">
      <span>
        Page {page} of {Math.max(1, totalPages)}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1 rounded-lg border border-hair/50 px-2.5 py-1.5 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center gap-1 rounded-lg border border-hair/50 px-2.5 py-1.5 disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const [debouncedQ, setDebouncedQ] = useState('')
  const [editing, setEditing] = useState<{ user: UserRow; mode: 'role' | 'credits' } | null>(null)
  const [roleValue, setRoleValue] = useState(ROLE_OPTIONS[0])
  const [amount, setAmount] = useState('10')
  const [reason, setReason] = useState('')

  useMemo(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [q])

  const usersQuery = useQuery({
    queryKey: ['admin-users', debouncedQ, role, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '25' })
      if (debouncedQ) params.set('q', debouncedQ)
      if (role) params.set('role', role)
      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{ users: UserRow[]; pagination: { page: number; totalPages: number } }>
    },
  })

  const roleMutation = useMutation({
    mutationFn: async ({ id, role: r }: { id: string; role: string }) => {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: r }),
      })
      if (!res.ok) throw new Error('Failed to update role')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Role updated')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditing(null)
    },
    onError: () => toast.error('Could not update role'),
  })

  const creditsMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await fetch(`/api/admin/users/${id}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), description: reason || 'Admin adjustment' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }))
        throw new Error(err.error ?? 'Failed')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Credits adjusted')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditing(null)
      setAmount('10')
      setReason('')
    },
    onError: (e) => toast.error(e.message),
  })

  const users = usersQuery.data?.users ?? []

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Accounts</p>
          <h1 className="display-md mt-2.5">Users</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email or name…"
            className="input-lux !pl-10"
          />
        </div>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1) }} className="input-lux w-auto">
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {usersQuery.isError && (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> Couldn&apos;t load users.
        </p>
      )}

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-hair/50 bg-onyx-2/50 backdrop-blur-sm">
        <div className="hidden grid-cols-[1fr_110px_90px_110px_70px_64px] gap-4 border-b border-hair/30 px-6 py-3.5 text-xs uppercase tracking-widest text-mist-2 md:grid">
          <span>User</span>
          <span className="text-center">Role</span>
          <span className="text-right">Credits</span>
          <span className="text-center">Sub status</span>
          <span className="text-center">Clips</span>
          <span className="text-right">Joined</span>
        </div>

        {usersQuery.isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={`sk-${i}`} className={`px-6 py-4 ${i > 0 ? 'border-t border-hair/30' : ''}`}>
                <div className="h-4 w-full animate-pulse rounded bg-surface" />
              </div>
            ))
          : users.map((u, i) => (
              <div
                key={u.id}
                className={`grid grid-cols-2 items-center gap-4 px-6 py-4 transition-colors hover:bg-surface md:grid-cols-[1fr_110px_90px_110px_70px_64px] ${
                  i > 0 ? 'border-t border-hair/30' : ''
                }`}
              >
                <Link href={`/admin/users/${u.id}`} className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.email}</p>
                  <p className="text-xs text-mist">{u.name || '—'} · {u._count.projects} proj</p>
                </Link>
                <div className="flex items-center gap-2 md:justify-center">
                  <span className={`truncate rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest ${ROLE_COLOR[u.role] ?? 'bg-pearl/10 text-mist'}`}>
                    {u.role}
                  </span>
                  <button
                    onClick={() => { setEditing({ user: u, mode: 'role' }); setRoleValue(u.role) }}
                    className="rounded-md border border-hair/50 px-1.5 py-0.5 text-[10px] text-mist transition-colors hover:text-gold"
                  >
                    edit
                  </button>
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                  <span className="text-sm font-medium text-gold">{u.credits}</span>
                  <button
                    onClick={() => { setEditing({ user: u, mode: 'credits' }); setReason('') }}
                    className="rounded-md border border-hair/50 px-1.5 py-0.5 text-[10px] text-mist transition-colors hover:text-gold"
                  >
                    adjust
                  </button>
                </div>
                <span className={`text-center text-[10px] uppercase tracking-widest ${u.subscriptionStatus === 'active' ? 'text-emerald-300' : 'text-mist-2'}`}>
                  {u.subscriptionStatus ?? '—'}
                </span>
                <span className="text-center text-sm font-light text-mist">{u._count.clips}</span>
                <span className="text-right text-xs font-light text-mist">
                  {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
      </div>

      {users.length === 0 && !usersQuery.isLoading && (
        <p className="mt-8 rounded-2xl border border-dashed border-hair/50 px-6 py-12 text-center text-sm font-light text-mist">
          No users match your filters.
        </p>
      )}

      <Pagination page={usersQuery.data?.pagination.page ?? 1} totalPages={usersQuery.data?.pagination.totalPages ?? 1} onPage={setPage} />

      {/* Action dialog */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-2xl border border-hair/50 bg-onyx-2 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl font-semibold">
              {editing.mode === 'role' ? 'Change role' : 'Adjust credits'}
            </h3>
            <p className="mt-1 truncate text-sm text-mist">{editing.user.email}</p>

            {editing.mode === 'role' ? (
              <div className="mt-5">
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-mist-2">Role</label>
                <div className="grid grid-cols-4 gap-2">
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRoleValue(r)}
                      className={`rounded-xl border px-2 py-2 text-xs font-medium transition-all ${
                        roleValue === r
                          ? 'border-gold bg-gold/15 text-gold'
                          : 'border-hair/50 text-mist hover:border-hair'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => roleMutation.mutate({ id: editing.user.id, role: roleValue })}
                  disabled={roleValue === editing.user.role || roleMutation.isPending}
                  className="btn-lux btn-gold mt-5 w-full"
                >
                  {roleMutation.isPending ? 'Saving…' : 'Save role'}
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-widest text-mist-2">Amount (+ add / − remove)</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setAmount(String(Math.max(-99999, Number(amount) - 10)))}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-hair/50 text-mist hover:text-gold"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="input-lux text-center font-display text-xl"
                    />
                    <button
                      onClick={() => setAmount(String(Math.min(99999, Number(amount) + 10)))}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-hair/50 text-mist hover:text-gold"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-light text-mist">
                    Current balance: <span className="text-gold">{editing.user.credits}</span> →{' '}
                    <span className="text-gold">{Math.max(0, editing.user.credits + (Number(amount) || 0))}</span>
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-widest text-mist-2">Reason (ledger)</label>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Refund for failed project"
                    className="input-lux"
                  />
                </div>
                <button
                  onClick={() => creditsMutation.mutate({ id: editing.user.id })}
                  disabled={!Number(amount) || creditsMutation.isPending}
                  className="btn-lux btn-gold flex w-full items-center justify-center gap-2"
                >
                  <Coins className="h-4 w-4" />
                  {creditsMutation.isPending ? 'Saving…' : 'Apply credits'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}