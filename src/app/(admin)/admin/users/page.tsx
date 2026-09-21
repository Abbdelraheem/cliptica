'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { toast } from 'sonner'
import { Search, Plus, Minus, AlertTriangle, ChevronLeft, ChevronRight, Coins, Gift, Megaphone } from 'lucide-react'

type UserRow = {
  id: string
  email: string
  name?: string | null
  role: string
  credits: number
  canCreateCampaigns?: boolean
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
  const [editing, setEditing] = useState<{ user: UserRow; mode: 'role' | 'credits' | 'plan' } | null>(null)
  const [roleValue, setRoleValue] = useState(ROLE_OPTIONS[0])
  const [selectedPlan, setSelectedPlan] = useState<'CLIPPER' | 'STUDIO' | 'FREE'>('CLIPPER')
  const [addPlanCredits, setAddPlanCredits] = useState(true)
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

  const planMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await fetch(`/api/admin/users/${id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          addPlanCredits,
          reason: reason || `Admin granted ${selectedPlan} subscription`,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to grant plan' }))
        throw new Error(err.error ?? 'Failed')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(
        `Granted ${selectedPlan} plan${data?.grantedCredits ? ` (+${data.grantedCredits} credits)` : ''}`
      )
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditing(null)
      setReason('')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not grant plan'),
  })

  const campaignPermissionMutation = useMutation({
    mutationFn: async ({ id, canCreateCampaigns }: { id: string; canCreateCampaigns: boolean }) => {
      const res = await fetch(`/api/admin/users/${id}/campaign-permission`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canCreateCampaigns }),
      })
      if (!res.ok) throw new Error('Failed to update campaign permission')
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(
        data.user.canCreateCampaigns
          ? `Campaign permission GRANTED to ${data.user.email}`
          : `Campaign permission REVOKED from ${data.user.email}`
      )
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: () => toast.error('Could not update campaign permission'),
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
                <div className="flex items-center gap-1.5 md:justify-center">
                  <span className={`truncate rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest ${ROLE_COLOR[u.role] ?? 'bg-pearl/10 text-mist'}`}>
                    {u.role}
                  </span>
                  <button
                    onClick={() => {
                      setEditing({ user: u, mode: 'role' })
                      setRoleValue(u.role)
                    }}
                    title="تعديل صلاحية ومستوى المستخدم (مستخدم، ستوديو، أدمن)"
                    className="flex items-center gap-1 rounded-md border border-purple-500/40 bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-300 transition-colors hover:bg-purple-500/25"
                  >
                    الصلاحية
                  </button>
                  <button
                    onClick={() => {
                      setEditing({ user: u, mode: 'plan' })
                      setSelectedPlan(u.role === 'CLIPPER' ? 'STUDIO' : 'CLIPPER')
                      setAddPlanCredits(true)
                      setReason('')
                    }}
                    title="Grant complimentary subscription"
                    className="flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[10px] font-medium text-gold transition-colors hover:bg-gold/20"
                  >
                    <Gift className="h-2.5 w-2.5" /> Plan
                  </button>
                  <button
                    onClick={() =>
                      campaignPermissionMutation.mutate({
                        id: u.id,
                        canCreateCampaigns: !u.canCreateCampaigns,
                      })
                    }
                    disabled={u.role === 'ADMIN' || campaignPermissionMutation.isPending}
                    title={
                      u.role === 'ADMIN'
                        ? 'Admin always has campaign permissions'
                        : u.canCreateCampaigns
                        ? 'Click to revoke campaign creation permission'
                        : 'Click to grant campaign creation permission'
                    }
                    className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      u.role === 'ADMIN' || u.canCreateCampaigns
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                        : 'border-hair/50 bg-black/20 text-mist-2 hover:border-gold/40 hover:text-gold'
                    }`}
                  >
                    <Megaphone className="h-2.5 w-2.5" />
                    <span>
                      {u.role === 'ADMIN'
                        ? 'Admin'
                        : u.canCreateCampaigns
                        ? 'Campaigns ✓'
                        : '+ Campaign'}
                    </span>
                  </button>
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                  <span className="text-sm font-medium text-gold">{u.credits}</span>
                  <button
                    onClick={() => { setEditing({ user: u, mode: 'credits' }); setAmount('100'); setReason('هدية ترحيبية / Welcome VIP Gift') }}
                    title="Gift or adjust credits"
                    className="flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold transition-colors hover:bg-gold/25"
                  >
                    <Gift className="h-3 w-3" /> أهدِ كريديت
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
              {editing.mode === 'role'
                ? 'Change role'
                : editing.mode === 'plan'
                ? 'Grant complimentary plan'
                : 'Adjust credits'}
            </h3>
            <p className="mt-1 truncate text-sm text-mist">{editing.user.email}</p>

            {editing.mode === 'plan' ? (
              <div className="mt-5 space-y-4">
                <p className="text-xs text-mist">
                  Grant a subscription without requiring online checkout. Sets active status and unlocks plan benefits.
                </p>

                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'CLIPPER' as const, name: 'Starter', desc: '150 clips/mo', badge: '$29/mo' },
                    { id: 'STUDIO' as const, name: 'Pro Creator', desc: '400 clips/mo', badge: '$59/mo' },
                    { id: 'FREE' as const, name: 'Free', desc: '30 free clips', badge: 'Reset' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlan(p.id)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                        selectedPlan === p.id
                          ? 'border-gold bg-gold/15 text-gold ring-1 ring-gold'
                          : 'border-hair/50 bg-black/20 text-mist hover:border-hair'
                      }`}
                    >
                      <span className="text-xs font-bold text-pearl">{p.name}</span>
                      <span className="mt-0.5 text-[10px] text-mist-2">{p.desc}</span>
                      <span className="mt-1 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-mono text-champagne">{p.badge}</span>
                    </button>
                  ))}
                </div>

                {selectedPlan !== 'FREE' && (
                  <label className="flex items-center gap-2.5 rounded-xl border border-hair/40 bg-black/20 p-3 text-xs text-mist cursor-pointer hover:border-gold/50">
                    <input
                      type="checkbox"
                      checked={addPlanCredits}
                      onChange={(e) => setAddPlanCredits(e.target.checked)}
                      className="h-4 w-4 rounded border-hair bg-onyx text-gold focus:ring-gold"
                    />
                    <span>
                      Deposit plan credits immediately ({selectedPlan === 'CLIPPER' ? '+150 credits' : '+400 credits'})
                    </span>
                  </label>
                )}

                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-widest text-mist-2">Reason (ledger)</label>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. VIP Creator / Promotion / Complimentary grant"
                    className="input-lux"
                  />
                </div>

                <button
                  onClick={() => planMutation.mutate({ id: editing.user.id })}
                  disabled={planMutation.isPending}
                  className="btn-lux btn-gold flex w-full items-center justify-center gap-2"
                >
                  <Gift className="h-4 w-4" />
                  {planMutation.isPending ? 'Granting…' : `Grant ${selectedPlan} Subscription`}
                </button>
              </div>
            ) : editing.mode === 'role' ? (
              <div className="mt-5 space-y-4">
                <p className="text-xs text-mist leading-relaxed">
                  اختر الصلاحية المناسبة للمستخدم. التغيير يطبق فورياً على مستوى الحساب وميزات المنصة المتاحة.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'FREE', title: 'Free (مستخدم مجاني)', desc: 'حساب عادي مع رصيد تجريبي فقط، بدون وصول للحملات' },
                    { id: 'CLIPPER', title: 'Clipper ($29/mo)', desc: 'باقة المبتدئين للمونتاج الفردي 150 مقطع شهرياً' },
                    { id: 'STUDIO', title: 'Studio ($59/mo)', desc: 'باقة الاستوديو: تفعيل إنشاء الحملات والأوتوبايلوت الكامل' },
                    { id: 'ADMIN', title: 'Admin (مدير كامل)', desc: 'رصيد لا نهائي (∞) وصلاحية الوصول الكامل للوحة التحكم' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoleValue(r.id)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                        roleValue === r.id
                          ? 'border-gold bg-gold/15 text-gold ring-1 ring-gold'
                          : 'border-hair/50 bg-black/20 text-mist hover:border-hair hover:text-pearl'
                      }`}
                    >
                      <span className="text-xs font-bold text-pearl">{r.title}</span>
                      <span className="mt-1 text-[10px] text-mist-2 leading-tight">{r.desc}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => roleMutation.mutate({ id: editing.user.id, role: roleValue })}
                  disabled={roleValue === editing.user.role || roleMutation.isPending}
                  className="btn-lux btn-gold mt-4 w-full font-bold"
                >
                  {roleMutation.isPending ? 'جاري الحفظ...' : `حفظ وتعيين كـ ${roleValue}`}
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-widest text-mist-2">Quick presets / اختيارات سريعة</label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[25, 50, 100, 250, 500, 1000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(String(preset))}
                        className={`rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                          amount === String(preset)
                            ? 'border-gold bg-gold/20 text-gold font-bold'
                            : 'border-hair/50 bg-black/20 text-mist hover:text-pearl'
                        }`}
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>

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
                    <span className="text-gold font-bold">{Math.max(0, editing.user.credits + (Number(amount) || 0))}</span>
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-widest text-mist-2">Quick reason / سبب الإهداء</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      'هدية ترحيبية / Welcome Gift',
                      'VIP Creator Bonus',
                      'تعويض دعم فني / Support',
                      'شحن تجريبي / Free Trial',
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setReason(chip)}
                        className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                          reason === chip
                            ? 'border-gold bg-gold/15 text-gold'
                            : 'border-hair/50 bg-black/20 text-mist hover:border-hair hover:text-pearl'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. VIP Creator grant / Bonus / Refund"
                    className="input-lux"
                  />
                </div>

                <button
                  onClick={() => creditsMutation.mutate({ id: editing.user.id })}
                  disabled={!Number(amount) || creditsMutation.isPending}
                  className="btn-lux btn-gold flex w-full items-center justify-center gap-2 font-bold"
                >
                  <Coins className="h-4 w-4" />
                  {creditsMutation.isPending ? 'Saving…' : Number(amount) > 0 ? `🎁 إهداء ${amount} كريديت` : `خصم ${Math.abs(Number(amount))} كريديت`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}