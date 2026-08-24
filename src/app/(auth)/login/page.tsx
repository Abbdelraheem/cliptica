'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldAlert } from 'lucide-react'
import { Wordmark } from '@/components/logo'
import { getDeviceId } from '@/lib/fingerprint'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [deviceId, setDeviceId] = useState('')

  useEffect(() => {
    getDeviceId().then(setDeviceId)
    const err = new URLSearchParams(window.location.search).get('error')
    if (err === 'DeviceConflict') {
      setError(
        'This device is already linked to another account. One account per device is allowed.'
      )
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Pre-check: precise message when this device belongs to another account.
      const check = await fetch('/api/device/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, email }),
      })
      if (check.status === 403) {
        const data = await check.json().catch(() => null)
        setError(data?.message ?? 'This device already has another Nology account.')
        return
      }

      // Precise message for accounts that haven't confirmed their email yet.
      const verification = await fetch('/api/auth/verification-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (verification.ok) {
        const { needsVerification } = await verification.json().catch(() => ({ needsVerification: false }))
        if (needsVerification) {
          setError('Please verify your email first. Check your inbox for the confirmation link, or resend it from the verify page.')
          return
        }
      }

      const res = await signIn('credentials', {
        email,
        password,
        deviceId,
        redirect: false,
      })
      if (res?.error) {
        setError('Invalid email or password.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function oauth(provider: 'google' | 'github') {
    // Device enforcement for OAuth happens on first dashboard load.
    signIn(provider, { callbackUrl: '/dashboard' })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-onyx px-6 text-pearl">
      <div className="amb" aria-hidden="true" />

      <div className="relative z-[2] w-full max-w-md">
        <Link href="/" className="mb-10 flex justify-center" aria-label="NOLOGY home">
          <Wordmark size={30} />
        </Link>

        <div className="rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.05] to-pearl/[0.01] p-9 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Welcome back</p>
          <h1 className="display-md mt-3">Welcome back, creator</h1>
          <p className="mt-2 rounded-lg border border-hair bg-surface px-4 py-2.5 text-xs leading-relaxed text-mist-2">
            Preview build — accounts activate once the backend goes live.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-light text-mist">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                className="input-lux"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-light text-mist">Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-lux"
              />
            </div>

            {error && (
              <p className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-lux btn-gold w-full disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log in'}
            </button>

            <p className="text-center text-sm font-light text-mist-2">
              <Link href="/forgot-password" className="underline underline-offset-4 hover:text-gold">
                Forgot password?
              </Link>
            </p>
          </form>

          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-hair/40" />
            <span className="text-xs uppercase tracking-widest text-mist-2">or</span>
            <span className="h-px flex-1 bg-hair/40" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => oauth('google')}
              className="btn-lux btn-outline !py-3 !text-sm"
            >
              Google
            </button>
            <button
              onClick={() => oauth('github')}
              className="btn-lux btn-outline !py-3 !text-sm"
            >
              GitHub
            </button>
          </div>

          <p className="mt-7 text-center text-sm font-light text-mist">
            New to NOLOGY?{' '}
            <Link href="/register" className="text-gold underline underline-offset-4 hover:text-champagne">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
