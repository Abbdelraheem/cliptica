'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Clapperboard, Loader2, ShieldCheck } from 'lucide-react'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [name, setName] = useState(session?.user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profileError, setProfileError] = useState('')

  // Admin-only AI motion graphics kill switch
  const isAdmin = session?.user?.role === 'ADMIN'
  const [motionOn, setMotionOn] = useState<boolean | null>(null)
  const [motionBusy, setMotionBusy] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/admin/motion-fx')
      .then(async (r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => setMotionOn(!!d.enabled))
      .catch(() => setMotionOn(false))
  }, [isAdmin])

  async function toggleMotion() {
    if (motionOn === null) return
    setMotionBusy(true)
    try {
      const res = await fetch('/api/admin/motion-fx', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !motionOn }),
      })
      if (res.ok) setMotionOn(!motionOn)
    } finally {
      setMotionBusy(false)
    }
  }

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileError('')
    setSaving(true)
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        setProfileError('Failed to update profile. Please try again.')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setProfileError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">Your account</p>
      <h1 className="display-md mt-2.5">Settings</h1>

      {/* Profile */}
      <section className="mt-10 rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.05] to-pearl/[0.01] p-8 backdrop-blur-xl">
        <h2 className="font-display text-2xl font-semibold">Profile</h2>
        <form onSubmit={handleProfile} className="mt-6 space-y-5">
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-light text-mist">Display name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="input-lux"
            />
          </div>
          <div>
            <label htmlFor="email2" className="mb-2 block text-sm font-light text-mist">Email</label>
            <input
              id="email2"
              type="email"
              value={session?.user?.email ?? ''}
              disabled
              className="input-lux opacity-60"
            />
            <p className="mt-1.5 text-xs font-light text-mist-2">Email changes require contacting support.</p>
          </div>
          {profileError && (
            <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">
              {profileError}
            </p>
          )}
          <button type="submit" disabled={saving} className="btn-lux btn-gold disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? 'Saved ✓' : 'Save changes'}
          </button>
        </form>
      </section>

      {/* Admin — AI motion graphics switch */}
      {isAdmin && (
        <section className="mt-8 rounded-3xl border border-champagne/30 bg-champagne/[0.05] p-8">
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-gold" /> Admin
          </h2>
          <div className="mt-6 flex items-center gap-4 rounded-xl border border-hair/60 bg-black/20 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-champagne">
              <Clapperboard className="h-5 w-5 text-black" />
            </span>
            <span className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-pearl">AI Motion Graphics</p>
              <p className="mt-0.5 text-xs leading-snug text-mist-2">
                Global switch — when off, the option disappears for everyone and queued jobs skip it (no +2 charge).
              </p>
            </span>
            {motionOn === null ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-mist" />
            ) : (
              <button
                type="button"
                onClick={toggleMotion}
                disabled={motionBusy}
                aria-label={motionOn ? 'Disable AI motion graphics' : 'Enable AI motion graphics'}
                className={`relative h-7 w-13 shrink-0 rounded-full px-0.5 transition-colors disabled:opacity-50 ${
                  motionOn ? 'bg-gradient-to-r from-gold to-champagne' : 'bg-white/15'
                }`}
                style={{ width: 52 }}
              >
                <span
                  className={`block h-6 w-6 rounded-full bg-white shadow transition-all ${
                    motionOn ? 'translate-x-[24px]' : 'translate-x-0'
                  }`}
                />
              </button>
            )}
            <span
              className={`w-10 shrink-0 text-right font-mono text-xs ${
                motionOn ? 'text-emerald-300' : 'text-mist'
              }`}
            >
              {motionOn === null ? '…' : motionOn ? 'ON' : 'OFF'}
            </span>
          </div>
        </section>
      )}

      {/* Danger zone */}
      <section className="mt-8 rounded-3xl border border-red-400/25 bg-red-400/[0.04] p-8">
        <h2 className="font-display text-2xl font-semibold text-red-300">Danger zone</h2>
        <p className="mt-2 text-sm font-light text-mist">
          Deleting your account removes all projects, clips and ledger history. This cannot be undone.
        </p>
        <button className="btn-lux mt-6 border border-red-400/40 !bg-transparent text-red-300 hover:!bg-red-400/10">
          Delete account
        </button>
      </section>
    </div>
  )
}
