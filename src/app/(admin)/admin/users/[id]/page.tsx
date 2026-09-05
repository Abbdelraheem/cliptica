'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  AlertTriangle,
  MonitorSmartphone,
  Coins,
  FolderKanban,
  Banknote,
  Megaphone,
  Film,
  BadgeCheck,
} from 'lucide-react'

type UserDetail = {
  id: string
  email: string
  name?: string | null
  avatar?: string | null
  role: string
  credits: number
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  stripePriceId?: string | null
  subscriptionStatus?: string | null
  emailVerified?: string | null
  createdAt: string
  updatedAt: string
  _count: {
    projects: number
    clips: number
    payouts: number
    campaigns: number
    devices: number
    apiKeys: number
    creditTransactions: number
    sessions: number
  }
  devices: { id: string; fingerprintHash: string; userAgent?: string | null; lastSeenAt: string; createdAt: string }[]
  creditTransactions: { id: string; amount: number; type: string; description: string; createdAt: string }[]
  projects: {
    id: string
    title: string
    status: string
    duration: number
    createdAt: string
    _count: { clips: number; processingJobs: number }
  }[]
  payouts: {
    id: string
    amount: string
    status: string
    periodEnd: string
    campaign?: { name: string } | null
  }[]
  campaigns: { id: string; name: string; type: string; isActive: boolean; createdAt: string }[]
  clips: {
    id: string
    title: string
    viralScore: number
    status: string
    duration: number
    project?: { title: string } | null
    createdAt: string
  }[]
}

const ROLE_COLOR: Record<string, string> = {
  ADMIN: 'bg-gold/20 text-gold',
  CLIPPER: 'bg-champagne/15 text-champagne',
  STUDIO: 'bg-sky-400/15 text-sky-300',
  FREE: 'bg-pearl/10 text-mist',
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const query = useQuery({
    queryKey: ['admin-user', id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${id}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{ user: UserDetail }>
    },
  })

  const user = query.data?.user

  return (
    <div className="mx-auto max-w-7xl">
      <button
        onClick={() => router.push('/admin/users')}
        className="flex items-center gap-2 text-sm text-mist transition-colors hover:text-pearl"
      >
        <ArrowLeft className="h-4 w-4" /> Back to users
      </button>

      {query.isError && (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> Couldn&apos;t load this user.
        </p>
      )}

      {query.isLoading && (
        <div className="mt-6 space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card !p-6">
              <div className="h-4 w-1/3 animate-pulse rounded bg-surface" />
            </div>
          ))}
        </div>
      )}

      {user && (
        <>
          {/* Header card */}
          <div className="mt-6 glass-card !p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/30 to-champagne/10 font-display text-xl font-bold text-gold">
                  {(user.name?.[0] ?? user.email[0] ?? '?').toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl font-semibold">{user.name ?? user.email}</h1>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest ${ROLE_COLOR[user.role]}`}>
                      {user.role}
                    </span>
                    {user.emailVerified && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-deep/30 px-2.5 py-1 text-[10px] uppercase tracking-widest text-emerald-300">
                        <BadgeCheck className="h-3 w-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-light text-mist">{user.email}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-mist-2">Credits</p>
                <p className="font-display text-3xl font-semibold text-gold">{user.credits}</p>
                <p className="mt-1 text-xs font-light text-mist">Joined {fmtDate(user.createdAt)}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {[
                { label: 'Projects', value: user._count.projects, icon: FolderKanban },
                { label: 'Clips', value: user._count.clips, icon: Film },
                { label: 'Payouts', value: user._count.payouts, icon: Banknote },
                { label: 'Campaigns', value: user._count.campaigns, icon: Megaphone },
                { label: 'Devices', value: user._count.devices, icon: MonitorSmartphone },
                { label: 'Ledger entries', value: user._count.creditTransactions, icon: Coins },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-hair/40 bg-surface/50 p-3">
                  <s.icon className="h-4 w-4 text-gold" />
                  <p className="mt-2 font-display text-lg font-semibold">{s.value}</p>
                  <p className="text-[10px] uppercase tracking-widest text-mist-2">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <p className="font-light text-mist">
                Subscription: <span className="font-medium text-pearl">{user.subscriptionStatus ?? '—'}</span>{' '}
                {user.stripePriceId && <span className="text-mist-2">({user.stripePriceId})</span>}
              </p>
              <p className="font-light text-mist">
                Stripe customer: <span className="font-mono text-xs text-pearl">{user.stripeCustomerId ?? '—'}</span>
              </p>
              <p className="font-light text-mist">
                Stripe subscription: <span className="font-mono text-xs text-pearl">{user.stripeSubscriptionId ?? '—'}</span>
              </p>
            </div>
          </div>

          {/* Devices */}
          <section className="mt-5 glass-card !p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <MonitorSmartphone className="h-5 w-5 text-gold" /> Devices ({user._count.devices})
            </h2>
            <div className="mt-4 space-y-2">
              {user.devices.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hair/40 bg-surface/40 px-3 py-2">
                  <span className="font-mono text-xs text-mist">{d.fingerprintHash.slice(0, 32)}…</span>
                  <span className="text-xs text-mist">{d.userAgent ?? '—'}</span>
                  <span className="text-xs font-light text-mist">Last seen {fmtDate(d.lastSeenAt)}</span>
                </div>
              ))}
              {user.devices.length === 0 && <p className="text-sm font-light text-mist">No devices registered.</p>}
            </div>
          </section>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {/* Credit ledger */}
            <section className="glass-card !p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Coins className="h-5 w-5 text-gold" /> Credit ledger
                </h2>
                <Link href="/admin/payments" className="text-xs font-medium text-gold hover:underline">Full ledger</Link>
              </div>
              <div className="mt-4 space-y-1">
                {user.creditTransactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-surface">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.description}</p>
                      <p className="text-[10px] uppercase tracking-widest text-mist-2">{t.type} · {fmtDate(t.createdAt)}</p>
                    </div>
                    <span className={`text-sm font-semibold ${t.amount >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {t.amount >= 0 ? `+${t.amount}` : t.amount}
                    </span>
                  </div>
                ))}
                {user.creditTransactions.length === 0 && <p className="text-sm font-light text-mist">No ledger entries.</p>}
              </div>
            </section>

            {/* Projects */}
            <section className="glass-card !p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <FolderKanban className="h-5 w-5 text-gold" /> Projects
                </h2>
                <Link href="/admin/projects" className="text-xs font-medium text-gold hover:underline">All projects</Link>
              </div>
              <div className="mt-4 space-y-1">
                {user.projects.map((p) => (
                  <Link key={p.id} href={`/admin/projects/${p.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-surface">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      <p className="text-xs text-mist">{p._count.clips} clips · {p._count.processingJobs} jobs</p>
                    </div>
                    <span className="text-xs font-light text-mist">{p.status}</span>
                  </Link>
                ))}
                {user.projects.length === 0 && <p className="text-sm font-light text-mist">No projects.</p>}
              </div>
            </section>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {/* Payouts */}
            <section className="glass-card !p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Banknote className="h-5 w-5 text-gold" /> Payouts
              </h2>
              <div className="mt-4 space-y-1">
                {user.payouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-surface">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.campaign?.name ?? 'Manual entry'}</p>
                      <p className="text-[10px] uppercase tracking-widest text-mist-2">{p.status} · {fmtDate(p.periodEnd)}</p>
                    </div>
                    <span className="text-sm font-semibold text-gold">${Number(p.amount).toFixed(2)}</span>
                  </div>
                ))}
                {user.payouts.length === 0 && <p className="text-sm font-light text-mist">No payouts.</p>}
              </div>
            </section>

            {/* Campaigns + clips */}
            <section className="glass-card !p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Megaphone className="h-5 w-5 text-gold" /> Campaigns
              </h2>
              <div className="mt-4 space-y-1">
                {user.campaigns.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-surface">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-widest ${c.isActive ? 'bg-emerald-deep/30 text-emerald-300' : 'bg-pearl/10 text-mist'}`}>
                      {c.isActive ? 'Active' : 'Paused'} · {c.type}
                    </span>
                  </div>
                ))}
                {user.campaigns.length === 0 && <p className="text-sm font-light text-mist">No campaigns.</p>}
              </div>

              <h2 className="mt-5 flex items-center gap-2 font-display text-lg font-semibold">
                <Film className="h-5 w-5 text-gold" /> Recent clips
              </h2>
              <div className="mt-4 space-y-1">
                {user.clips.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-surface">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-mist">{c.project?.title ?? ''} · {c.duration}s</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-gold">Score {c.viralScore}</span>
                      <span className="text-[9px] uppercase tracking-widest text-mist-2">{c.status}</span>
                    </div>
                  </div>
                ))}
                {user.clips.length === 0 && <p className="text-sm font-light text-mist">No clips.</p>}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}