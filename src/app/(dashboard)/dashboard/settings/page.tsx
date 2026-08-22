'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [name, setName] = useState(session?.user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
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
          <button type="submit" disabled={saving} className="btn-lux btn-gold disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? 'Saved ✓' : 'Save changes'}
          </button>
        </form>
      </section>

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
