'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  Bell,
  Check,
  Copy,
  KeyRound,
  Laptop,
  Loader2,
  Lock,
  Plus,
  Share2,
  ExternalLink,
  Unlink,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Trash2,
  Megaphone,
  DollarSign,
  TrendingUp,
  Video,
} from 'lucide-react'
import { ConnectionSummary } from '@/lib/social/types'

interface ApiKeyItem {
  id: string
  name: string
  maskedKey: string
  lastUsed: string | null
  createdAt: string
}

interface SessionItem {
  id: string
  sessionToken: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: string
  expires: string
}

interface NotificationPrefs {
  notifyOnComplete: boolean
  notifyOnLowCredits: boolean
  notifyOnWeeklyDigest: boolean
}

interface CampaignItem {
  id: string
  name: string
  type: 'WHOP_CONTENT_REWARDS' | 'BRAND_DEAL' | 'OWN_CHANNEL'
  platform: string | null
  ratePer1k: string | number
  flatFee?: string | number | null
  budget?: string | number | null
  deadline?: string | null
  isActive: boolean
  createdAt: string
  _count?: { clips: number }
  clips?: { views: number; estEarnings: string | number }[]
}

export default function SettingsPage() {
  const { data: session, update } = useSession()

  // Profile state
  const [name, setName] = useState(session?.user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profileError, setProfileError] = useState('')

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([])
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [creatingKey, setCreatingKey] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<{ name: string; rawKey: string } | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null)

  // Active Sessions state
  const [sessionsList, setSessionsList] = useState<SessionItem[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)
  const [revokingAllSessions, setRevokingAllSessions] = useState(false)

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationPrefs>({
    notifyOnComplete: true,
    notifyOnLowCredits: true,
    notifyOnWeeklyDigest: false,
  })
  const [loadingNotifs, setLoadingNotifs] = useState(true)
  const [savingNotifs, setSavingNotifs] = useState(false)

  // Social Connections state
  const [connections, setConnections] = useState<ConnectionSummary[]>([])
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<string | null>(null)
  const [socialBanner, setSocialBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Campaigns state
  const [campaignsList, setCampaignsList] = useState<CampaignItem[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false)
  const [creatingCampaign, setCreatingCampaign] = useState(false)
  const [campaignFormError, setCampaignFormError] = useState('')
  const [campaignActionId, setCampaignActionId] = useState<string | null>(null)

  // New campaign form fields
  const [newCampName, setNewCampName] = useState('')
  const [newCampType, setNewCampType] = useState<'WHOP_CONTENT_REWARDS' | 'BRAND_DEAL' | 'OWN_CHANNEL'>('WHOP_CONTENT_REWARDS')
  const [newCampPlatform, setNewCampPlatform] = useState('tiktok')
  const [newCampRate, setNewCampRate] = useState('1.50')
  const [newCampBudget, setNewCampBudget] = useState('')
  const [newCampFlatFee, setNewCampFlatFee] = useState('')
  const [newCampDeadline, setNewCampDeadline] = useState('')

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns')
      if (res.ok) {
        const data = await res.json()
        setCampaignsList(data.campaigns || [])
      }
    } catch {
    } finally {
      setLoadingCampaigns(false)
    }
  }

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    setCampaignFormError('')
    if (!newCampName.trim()) {
      setCampaignFormError('Please enter a campaign name')
      return
    }
    const rate = parseFloat(newCampRate)
    if (isNaN(rate) || rate <= 0) {
      setCampaignFormError('Please enter a valid rate per 1k views')
      return
    }

    setCreatingCampaign(true)
    try {
      const payload: Record<string, unknown> = {
        name: newCampName.trim(),
        type: newCampType,
        platform: newCampPlatform,
        ratePer1k: rate,
      }
      if (newCampBudget) payload.budget = parseFloat(newCampBudget)
      if (newCampFlatFee) payload.flatFee = parseFloat(newCampFlatFee)
      if (newCampDeadline) payload.deadline = newCampDeadline

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create campaign')
      }

      await fetchCampaigns()
      setShowNewCampaignModal(false)
      setNewCampName('')
      setNewCampBudget('')
      setNewCampFlatFee('')
      setNewCampDeadline('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error creating campaign'
      setCampaignFormError(message)
    } finally {
      setCreatingCampaign(false)
    }
  }

  const handleToggleCampaignActive = async (id: string, current: boolean) => {
    setCampaignActionId(id)
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !current }),
      })
      if (res.ok) {
        setCampaignsList((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isActive: !current } : c))
        )
      }
    } catch {}
    setCampaignActionId(null)
  }

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return
    setCampaignActionId(id)
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setCampaignsList((prev) => prev.filter((c) => c.id !== id))
      }
    } catch {}
    setCampaignActionId(null)
  }

  useEffect(() => {
    fetchCampaigns()
  }, [])

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name)
  }, [session])

  useEffect(() => {
    fetch('/api/user/api-keys')
      .then((r) => (r.ok ? r.json() : { keys: [] }))
      .then((d) => setApiKeys(d.keys || []))
      .catch(() => setApiKeys([]))
      .finally(() => setLoadingKeys(false))

    fetch('/api/user/sessions')
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((d) => setSessionsList(d.sessions || []))
      .catch(() => setSessionsList([]))
      .finally(() => setLoadingSessions(false))

    fetch('/api/user/notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setNotifications({
            notifyOnComplete: d.notifyOnComplete ?? true,
            notifyOnLowCredits: d.notifyOnLowCredits ?? true,
            notifyOnWeeklyDigest: d.notifyOnWeeklyDigest ?? false,
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoadingNotifs(false))

    fetch('/api/social/connections')
      .then((r) => (r.ok ? r.json() : { connections: [] }))
      .then((d) => setConnections(d.connections || []))
      .catch(() => setConnections([]))
      .finally(() => setLoadingConnections(false))

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const connected = urlParams.get('socialConnected')
      const err = urlParams.get('error')
      if (connected) {
        setSocialBanner({
          type: 'success',
          message: `Successfully connected ${connected.toUpperCase()}! You can now publish clips directly to your account.`,
        })
      } else if (err) {
        setSocialBanner({
          type: 'error',
          message: decodeURIComponent(err),
        })
      }
    }
  }, [])

  async function handleDisconnectSocial(platform: string) {
    setDisconnectingPlatform(platform)
    try {
      const res = await fetch(`/api/social/connections?platform=${platform}`, { method: 'DELETE' })
      if (res.ok) {
        setConnections((prev) =>
          prev.map((c) =>
            c.platform === platform
              ? {
                  ...c,
                  connected: false,
                  accountName: null,
                  accountId: null,
                  status: 'not_connected',
                }
              : c
          )
        )
      }
    } finally {
      setDisconnectingPlatform(null)
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
      const trimmed = name.trim()
      if (update) {
        await update({ name: trimmed })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setProfileError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }
    setSavingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPasswordError(data.error || 'Failed to update password.')
        return
      }
      setPasswordSuccess('Password updated successfully! Your new password is now active.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(''), 6000)
    } catch {
      setPasswordError('Something went wrong. Please try again.')
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault()
    if (!newKeyName.trim()) return
    setKeyError('')
    setCreatingKey(true)
    try {
      const res = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setKeyError(data.error || 'Failed to create API key.')
        return
      }
      setGeneratedKey({ name: data.key.name, rawKey: data.key.rawKey })
      setNewKeyName('')
      const listRes = await fetch('/api/user/api-keys')
      if (listRes.ok) {
        const listData = await listRes.json()
        setApiKeys(listData.keys || [])
      }
    } catch {
      setKeyError('Something went wrong creating API key.')
    } finally {
      setCreatingKey(false)
    }
  }

  async function handleRevokeKey(id: string) {
    setRevokingKeyId(id)
    try {
      const res = await fetch(`/api/user/api-keys/${id}`, { method: 'DELETE' })
      if (res.ok) setApiKeys((prev) => prev.filter((k) => k.id !== id))
    } finally {
      setRevokingKeyId(null)
    }
  }

  async function handleRevokeSession(id: string) {
    setRevokingSessionId(id)
    try {
      const res = await fetch(`/api/user/sessions/${id}`, { method: 'DELETE' })
      if (res.ok) setSessionsList((prev) => prev.filter((s) => s.id !== id))
    } finally {
      setRevokingSessionId(null)
    }
  }

  async function handleRevokeAllSessions() {
    setRevokingAllSessions(true)
    try {
      const res = await fetch('/api/user/sessions', { method: 'DELETE' })
      if (res.ok) setSessionsList([])
    } finally {
      setRevokingAllSessions(false)
    }
  }

  async function handleToggleNotification(key: keyof NotificationPrefs) {
    const updated = { ...notifications, [key]: !notifications[key] }
    setNotifications(updated)
    setSavingNotifs(true)
    try {
      await fetch('/api/user/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
    } finally {
      setSavingNotifs(false)
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

      {/* Security & Change Password */}
      <section className="mt-8 rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.05] to-pearl/[0.01] p-8 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Lock className="h-5 w-5 text-champagne" />
          <h2 className="font-display text-2xl font-semibold">Change Password</h2>
        </div>
        <p className="mt-2 text-sm font-light text-mist">Update your password to keep your account secure.</p>
        <form onSubmit={handlePasswordChange} className="mt-6 space-y-5">
          <div>
            <label htmlFor="currentPassword" className="mb-2 block text-sm font-light text-mist">Current password</label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="input-lux"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="newPassword" className="mb-2 block text-sm font-light text-mist">New password</label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="input-lux"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-light text-mist">Confirm new password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="input-lux"
              />
            </div>
          </div>
          {passwordError && (
            <p role="alert" className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {passwordError}
            </p>
          )}
          {passwordSuccess && (
            <p role="alert" className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm text-emerald-300">
              <Check className="h-4 w-4 shrink-0" />
              {passwordSuccess}
            </p>
          )}
          <button type="submit" disabled={savingPassword} className="btn-lux btn-gold disabled:opacity-60">
            {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
          </button>
        </form>
      </section>

      {/* API Key Management */}
      <section className="mt-8 rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.05] to-pearl/[0.01] p-8 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <KeyRound className="h-5 w-5 text-champagne" />
          <h2 className="font-display text-2xl font-semibold">API Keys</h2>
        </div>
        <p className="mt-2 text-sm font-light text-mist">Programmatic access tokens for external automated workflows.</p>

        {generatedKey && (
          <div className="mt-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
            <p className="text-sm font-semibold text-emerald-300">
              API Key Generated: {generatedKey.name}
            </p>
            <p className="mt-1 text-xs text-mist">
              Please copy your key now. For your security, it will never be displayed again.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedKey.rawKey}
                className="input-lux flex-1 font-mono text-xs text-emerald-200"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedKey.rawKey)
                  setCopiedKey(true)
                  setTimeout(() => setCopiedKey(false), 2000)
                }}
                className="btn-lux btn-gold !py-2.5 !px-4 text-xs"
              >
                {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedKey ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleCreateKey} className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            required
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. Zapier Workflow)"
            className="input-lux flex-1"
          />
          <button type="submit" disabled={creatingKey || !newKeyName.trim()} className="btn-lux btn-gold disabled:opacity-60">
            {creatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Generate key
          </button>
        </form>
        {keyError && (
          <p role="alert" className="mt-3 text-xs text-red-400">{keyError}</p>
        )}

        <div className="mt-6 divide-y divide-hair rounded-2xl border border-hair/60 bg-onyx/40">
          {loadingKeys ? (
            <div className="flex items-center justify-center p-6 text-sm text-mist">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading API keys...
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="p-6 text-center text-sm font-light text-mist-2">
              No API keys created yet. Generate one above to get started.
            </div>
          ) : (
            apiKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-4 sm:px-6">
                <div>
                  <p className="text-sm font-medium text-pearl">{k.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-mist-2">{k.maskedKey}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-light text-mist-2">
                    Created {new Date(k.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevokeKey(k.id)}
                    disabled={revokingKeyId === k.id}
                    title="Revoke key"
                    aria-label={`Revoke key ${k.name}`}
                    className="rounded-lg p-2 text-mist-2 transition-colors hover:bg-red-400/10 hover:text-red-300 disabled:opacity-50"
                  >
                    {revokingKeyId === k.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Active Sessions */}
      <section className="mt-8 rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.05] to-pearl/[0.01] p-8 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Laptop className="h-5 w-5 text-champagne" />
            <h2 className="font-display text-2xl font-semibold">Active Sessions</h2>
          </div>
          {sessionsList.length > 1 && (
            <button
              type="button"
              onClick={handleRevokeAllSessions}
              disabled={revokingAllSessions}
              className="text-xs text-red-300 underline underline-offset-4 hover:text-red-200 disabled:opacity-50"
            >
              {revokingAllSessions ? 'Revoking...' : 'Sign out everywhere'}
            </button>
          )}
        </div>
        <p className="mt-2 text-sm font-light text-mist">Manage active browsers and devices currently signed into your account.</p>

        <div className="mt-6 divide-y divide-hair rounded-2xl border border-hair/60 bg-onyx/40">
          {loadingSessions ? (
            <div className="flex items-center justify-center p-6 text-sm text-mist">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading sessions...
            </div>
          ) : sessionsList.length === 0 ? (
            <div className="p-6 text-center text-sm font-light text-mist-2">
              No active sessions tracked.
            </div>
          ) : (
            sessionsList.map((s, idx) => (
              <div key={s.id} className="flex items-center justify-between p-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-pearl">{s.userAgent || 'Web Browser'}</p>
                    {idx === 0 && (
                      <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-mist-2">
                    IP: {s.ipAddress || 'Unknown'} &middot; Signed in {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {idx !== 0 && (
                  <button
                    type="button"
                    onClick={() => handleRevokeSession(s.id)}
                    disabled={revokingSessionId === s.id}
                    title="Sign out session"
                    aria-label="Sign out this session"
                    className="ml-4 rounded-lg p-2 text-mist-2 transition-colors hover:bg-red-400/10 hover:text-red-300 disabled:opacity-50"
                  >
                    {revokingSessionId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="mt-8 rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.05] to-pearl/[0.01] p-8 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bell className="h-5 w-5 text-champagne" />
            <h2 className="font-display text-2xl font-semibold">Notification Preferences</h2>
          </div>
          {savingNotifs && <span className="text-xs text-champagne animate-pulse">Saving...</span>}
        </div>
        <p className="mt-2 text-sm font-light text-mist">Control which transactional updates are emailed to your address.</p>

        {loadingNotifs ? (
          <div className="flex items-center justify-center p-6 text-sm text-mist">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading preferences...
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <label className="flex items-start justify-between gap-4 rounded-2xl border border-hair/60 bg-onyx/40 p-4 cursor-pointer hover:border-hair transition-colors">
              <div>
                <p className="text-sm font-medium text-pearl">Video Processing Complete</p>
                <p className="mt-0.5 text-xs text-mist-2">Receive an email when your clips are finished rendering and ready to view.</p>
              </div>
              <input
                type="checkbox"
                checked={notifications.notifyOnComplete}
                onChange={() => handleToggleNotification('notifyOnComplete')}
                className="h-5 w-5 rounded accent-[#ff5a1f] cursor-pointer mt-0.5"
              />
            </label>

            <label className="flex items-start justify-between gap-4 rounded-2xl border border-hair/60 bg-onyx/40 p-4 cursor-pointer hover:border-hair transition-colors">
              <div>
                <p className="text-sm font-medium text-pearl">Low Credit Balance Alert</p>
                <p className="mt-0.5 text-xs text-mist-2">Notify you when your balance drops below 10 credits so rendering never stops.</p>
              </div>
              <input
                type="checkbox"
                checked={notifications.notifyOnLowCredits}
                onChange={() => handleToggleNotification('notifyOnLowCredits')}
                className="h-5 w-5 rounded accent-[#ff5a1f] cursor-pointer mt-0.5"
              />
            </label>

            <label className="flex items-start justify-between gap-4 rounded-2xl border border-hair/60 bg-onyx/40 p-4 cursor-pointer hover:border-hair transition-colors">
              <div>
                <p className="text-sm font-medium text-pearl">Weekly Performance Digest</p>
                <p className="mt-0.5 text-xs text-mist-2">Weekly analytics on virality scores, views, and campaign engagement.</p>
              </div>
              <input
                type="checkbox"
                checked={notifications.notifyOnWeeklyDigest}
                onChange={() => handleToggleNotification('notifyOnWeeklyDigest')}
                className="h-5 w-5 rounded accent-[#ff5a1f] cursor-pointer mt-0.5"
              />
            </label>
          </div>
        )}
      </section>

      {/* Social Accounts & Direct Publishing */}
      <section className="mt-8 rounded-3xl border border-hair bg-onyx/40 p-8 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2.5 font-display text-2xl font-semibold">
              <Share2 className="h-5 w-5 text-gold" /> Connected Accounts & Direct Publishing
              <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-champagne">
                Coming Soon
              </span>
            </h2>
            <p className="mt-1 text-sm font-light text-mist">
              Direct automated publishing to TikTok, YouTube Shorts, and Instagram Reels is in final testing and coming soon to your dashboard.
            </p>
          </div>
        </div>

        {socialBanner && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl border p-3.5 text-xs ${
              socialBanner.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}
          >
            {socialBanner.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            )}
            <span>{socialBanner.message}</span>
          </div>
        )}

        {loadingConnections ? (
          <div className="mt-6 flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-champagne" />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {connections.map((c) => {
              const isConnected = c.connected && c.status !== 'not_connected'
              const isExpired = c.status === 'expired'
              const isDisconnecting = disconnectingPlatform === c.platform

              return (
                <div
                  key={c.platform}
                  className={`flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                    isConnected
                      ? 'border-champagne/40 bg-champagne/[0.04]'
                      : 'border-hair/60 bg-black/20 hover:border-hair'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-pearl">{c.name}</span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isConnected
                            ? isExpired
                              ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
                              : 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                            : 'bg-white/5 text-mist-2 border border-white/10'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isConnected
                              ? isExpired
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                              : 'bg-mist-2'
                          }`}
                        />
                        {isConnected ? (isExpired ? 'Expired' : 'Active') : 'Not Connected'}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-mist">
                      {isConnected
                        ? `Connected as ${c.accountName ? `@${c.accountName}` : 'Account linked'}`
                        : c.platform === 'TIKTOK'
                        ? 'Publish clips directly to TikTok Content Posting API.'
                        : c.platform === 'YOUTUBE'
                        ? 'Direct upload to YouTube Shorts via Data API v3.'
                        : 'Auto-publish to Instagram Reels via Meta Graph API.'}
                    </p>

                    {!c.configured && (
                      <p className="mt-2 rounded bg-amber-400/10 p-2 text-[10px] text-amber-300/90 leading-relaxed border border-amber-400/20">
                        Requires developer credentials: <code className="font-mono font-semibold">{c.missingVars[0]}</code>
                      </p>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-hair-soft">
                    {isConnected ? (
                      <button
                        type="button"
                        onClick={() => handleDisconnectSocial(c.platform)}
                        disabled={isDisconnecting}
                        className="btn-lux btn-outline w-full !py-1.5 !text-xs !border-red-400/30 text-red-300 hover:!bg-red-400/10 flex items-center justify-center gap-1.5"
                      >
                        {isDisconnecting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Unlink className="h-3.5 w-3.5" />
                        )}
                        <span>Disconnect</span>
                      </button>
                    ) : (
                      <a
                        href={c.configured ? `/api/social/${c.platform.toLowerCase()}/connect?returnUrl=/dashboard/settings` : '#'}
                        onClick={(e) => {
                          if (!c.configured) {
                            e.preventDefault()
                            alert(`${c.name} credentials are not yet configured in environment variables (${c.missingVars.join(', ')}).`)
                          }
                        }}
                        className={`btn-lux w-full !py-1.5 !text-xs flex items-center justify-center gap-1.5 ${
                          c.configured
                            ? 'btn-champagne'
                            : 'cursor-not-allowed opacity-50 !bg-white/5 !text-mist !border-hair'
                        }`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>{c.configured ? 'Connect' : 'Coming Soon'}</span>
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Clipping Campaigns & Bounties */}
      <section className="mt-8 rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.05] to-pearl/[0.01] p-8 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Megaphone className="h-5 w-5 text-gold" />
            <div>
              <h2 className="font-display text-2xl font-semibold">Clipping Campaigns & Bounties</h2>
              <p className="mt-1 text-sm font-light text-mist">
                Add and manage clipping campaigns (Whop Content Rewards, Brand Deals, and Bounties).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/campaigns"
              className="btn-lux btn-outline !py-2 !px-3.5 !text-xs flex items-center gap-1.5"
            >
              <TrendingUp className="h-3.5 w-3.5 text-champagne" />
              <span>Full Analytics</span>
            </Link>
            <button
              type="button"
              onClick={() => setShowNewCampaignModal(true)}
              className="btn-lux btn-gold !py-2 !px-3.5 !text-xs flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Add Campaign</span>
            </button>
          </div>
        </div>

        {loadingCampaigns ? (
          <div className="flex items-center justify-center p-8 text-sm text-mist">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading campaigns...
          </div>
        ) : campaignsList.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-hair/60 bg-onyx/40 p-8 text-center">
            <p className="text-sm font-light text-mist">
              No clipping campaigns configured yet. Add your first campaign to start clipping and tracking rewards.
            </p>
            <button
              type="button"
              onClick={() => setShowNewCampaignModal(true)}
              className="btn-lux btn-gold mt-4 inline-flex items-center gap-2 !py-2 !px-4 !text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Campaign</span>
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaignsList.map((camp) => (
              <div
                key={camp.id}
                className="flex flex-col justify-between rounded-2xl border border-hair/60 bg-onyx/40 p-5 transition-all hover:border-hair"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        camp.isActive
                          ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/20'
                          : 'bg-white/5 text-mist-2 border border-white/10'
                      }`}
                    >
                      {camp.isActive ? 'Active' : 'Paused'}
                    </span>
                    <span className="rounded-md border border-hair/40 bg-surface/50 px-2 py-0.5 text-[10px] uppercase font-mono text-champagne">
                      {camp.platform || 'Multi-Platform'}
                    </span>
                  </div>

                  <h3 className="mt-3 font-display text-base font-semibold text-pearl line-clamp-1">{camp.name}</h3>
                  <p className="text-xs text-mist-2 mt-0.5">
                    {camp.type === 'WHOP_CONTENT_REWARDS'
                      ? 'Whop Content Rewards'
                      : camp.type === 'BRAND_DEAL'
                      ? 'Brand Deal Sponsorship'
                      : 'Own Channel Content'}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-hair/40 bg-surface/30 p-3 text-xs">
                    <div>
                      <span className="text-[10px] text-mist-2 block">Rate / 1K</span>
                      <span className="font-semibold text-gold">${Number(camp.ratePer1k).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-mist-2 block">Clips Linked</span>
                      <span className="font-semibold text-pearl">{camp._count?.clips ?? 0}</span>
                    </div>
                    {camp.budget ? (
                      <div className="col-span-2 pt-1 border-t border-hair/20">
                        <span className="text-[10px] text-mist-2 block">Pool Budget</span>
                        <span className="font-semibold text-pearl">${Number(camp.budget).toLocaleString()}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-hair-soft flex items-center justify-between gap-2">
                  <Link
                    href="/dashboard/projects/new?tab=campaign"
                    className="btn-lux btn-outline !py-1.5 !px-3 !text-xs flex items-center gap-1 text-pearl hover:text-gold"
                  >
                    <Video className="h-3.5 w-3.5 text-champagne" />
                    <span>Clip Video</span>
                  </Link>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleCampaignActive(camp.id, camp.isActive)}
                      disabled={campaignActionId === camp.id}
                      className="rounded-lg border border-hair/40 bg-surface/40 px-2.5 py-1.5 text-xs text-mist hover:text-pearl transition-colors disabled:opacity-50"
                    >
                      {camp.isActive ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCampaign(camp.id)}
                      disabled={campaignActionId === camp.id}
                      aria-label="Delete campaign"
                      className="rounded-lg p-1.5 text-mist-2 hover:bg-red-400/10 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* New Campaign Modal */}
      {showNewCampaignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-onyx/80 px-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowNewCampaignModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-hair bg-onyx-2 p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-hair/40 pb-4">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-gold" />
                <h3 className="font-display text-xl font-semibold text-pearl">Create Clipping Campaign</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewCampaignModal(false)}
                className="text-mist hover:text-pearl text-sm"
              >
                ✕
              </button>
            </div>

            {campaignFormError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{campaignFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-mist">Campaign Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Whop AI Content Rewards, Tech Brand Deal"
                  value={newCampName}
                  onChange={(e) => setNewCampName(e.target.value)}
                  className="input-lux mt-1.5 w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-mist">Type</label>
                  <select
                    value={newCampType}
                    onChange={(e) => setNewCampType(e.target.value as any)}
                    className="input-lux mt-1.5 w-full text-xs"
                  >
                    <option value="WHOP_CONTENT_REWARDS">Whop Content Rewards</option>
                    <option value="BRAND_DEAL">Brand Deal Sponsorship</option>
                    <option value="OWN_CHANNEL">Own Channel Growth</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-mist">Platform</label>
                  <select
                    value={newCampPlatform}
                    onChange={(e) => setNewCampPlatform(e.target.value)}
                    className="input-lux mt-1.5 w-full text-xs"
                  >
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube Shorts</option>
                    <option value="instagram">Instagram Reels</option>
                    <option value="all">Multi-Platform</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-mist">Rate per 1,000 Views ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="1.50"
                    value={newCampRate}
                    onChange={(e) => setNewCampRate(e.target.value)}
                    className="input-lux mt-1.5 w-full font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-mist">Total Budget ($)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="Optional (e.g. 500)"
                    value={newCampBudget}
                    onChange={(e) => setNewCampBudget(e.target.value)}
                    className="input-lux mt-1.5 w-full font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-mist">Flat Fee / Base Pay ($)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="Optional (e.g. 50)"
                    value={newCampFlatFee}
                    onChange={(e) => setNewCampFlatFee(e.target.value)}
                    className="input-lux mt-1.5 w-full font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-mist">Deadline Date</label>
                  <input
                    type="date"
                    value={newCampDeadline}
                    onChange={(e) => setNewCampDeadline(e.target.value)}
                    className="input-lux mt-1.5 w-full text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewCampaignModal(false)}
                  className="btn-lux btn-ghost !py-2 !px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCampaign}
                  className="btn-lux btn-gold !py-2 !px-5 text-xs flex items-center gap-2 disabled:opacity-60"
                >
                  {creatingCampaign ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    'Save Campaign'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Danger zone */}
      <section className="mt-8 rounded-3xl border border-red-400/25 bg-red-400/[0.04] p-8">
        <h2 className="font-display text-2xl font-semibold text-red-300">Danger zone</h2>
        <p className="mt-2 text-sm font-light text-mist">
          Deleting your account removes all projects, clips and ledger history. This cannot be undone.
        </p>
        <a
          href={`mailto:support@clipzila.com?subject=${encodeURIComponent('Account deletion request')}&body=${encodeURIComponent(`Please delete my account (${session?.user?.email ?? ''}).`)}`}
          className="btn-lux mt-6 inline-flex border border-red-400/40 !bg-transparent text-red-300 hover:!bg-red-400/10"
        >
          Request account deletion
        </a>
      </section>
    </div>
  )
}
