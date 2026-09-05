'use client'

import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Save, RotateCcw } from 'lucide-react'

type Setting = { key: string; kind: 'bool' | 'number' | 'string'; label: string; enabled: boolean }
type SettingsState = Record<string, boolean | number>

const DEFAULTS: SettingsState = {
  motion_fx: true,
  pipeline_premium: true,
  min_credits_required: 10,
  max_upload_mb: 500,
  clips_per_video: 6,
  clip_target_seconds: 38,
  render_parallel: 4,
  stale_job_minutes: 30,
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsState | null>(null)
  const [keys, setKeys] = useState<Setting[]>([])
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((d) => {
        setSettings(d.settings)
        setKeys(d.keys)
      })
      .catch(() => toast.error('Could not load settings'))
  }, [])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('Failed to save')
      return res.json()
    },
    onSuccess: (d) => {
      setSettings(d.settings)
      setDirty(false)
      toast.success('Settings saved')
    },
    onError: () => toast.error('Could not save settings'),
  })

  const setValue = (key: string, value: boolean | number) => {
    setSettings((s) => ({ ...s, [key]: value }))
    setDirty(true)
  }

  const reset = () => {
    setSettings(DEFAULTS)
    setDirty(true)
  }

  if (!settings) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="h-6 w-40 animate-pulse rounded bg-surface" />
        <div className="mt-4 h-40 animate-pulse rounded-2xl bg-surface" />
      </div>
    )
  }

  const numSettings = keys.filter((k) => k.kind === 'number')
  const boolSettings = keys.filter((k) => k.kind === 'bool')

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Platform</p>
          <h1 className="display-md mt-2.5">Settings</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={reset} className="btn-lux flex items-center gap-2 border border-hair/50 text-mist hover:text-pearl">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
            className="btn-lux btn-gold flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="mt-8 space-y-5">
        {/* Toggles */}
        <section className="glass-card !p-6">
          <h2 className="font-display text-lg font-semibold">Behavior</h2>
          <div className="mt-4 divide-y divide-hair/30">
            {boolSettings.map((k) => (
              <div key={k.key} className="flex items-center justify-between py-3.5">
                <div>
                  <p className="font-medium">{k.label}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-mist-2">{k.key}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={Boolean(settings[k.key])}
                  onClick={() => setValue(k.key, !settings[k.key])}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    settings[k.key] ? 'bg-gradient-to-r from-champagne to-gold' : 'bg-surface'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      settings[k.key] ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Numbers */}
        <section className="glass-card !p-6">
          <h2 className="font-display text-lg font-semibold">Limits & sizing</h2>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {numSettings.map((k) => (
              <div key={k.key} className="rounded-xl border border-hair/40 bg-surface/40 p-4">
                <label className="text-sm font-medium">{k.label}</label>
                <p className="font-mono text-[10px] uppercase tracking-widest text-mist-2">{k.key}</p>
                <input
                  type="number"
                  value={Number(settings[k.key])}
                  min={0}
                  onChange={(e) => setValue(k.key, Number(e.target.value))}
                  className="input-lux mt-3"
                />
              </div>
            ))}
          </div>
        </section>

        <p className="flex items-start gap-2 rounded-xl border border-champagne/20 bg-champagne/5 px-4 py-3 text-xs font-light text-mist">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-champagne" />
          These settings are read at runtime by the worker and web app. Changes apply to new jobs immediately.
        </p>
      </div>
    </div>
  )
}