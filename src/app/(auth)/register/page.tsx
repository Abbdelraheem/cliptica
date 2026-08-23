'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, ShieldAlert } from 'lucide-react'
import { Wordmark } from '@/components/logo'
import { getDeviceId } from '@/lib/fingerprint'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [deviceId, setDeviceId] = useState('')

  useEffect(() => {
    getDeviceId().then(setDeviceId)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, deviceId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(
          data?.error === 'DEVICE_LIMIT'
            ? (data?.message ?? 'This device already has a Nology account. One account per device.')
            : (data?.error === 'Email already registered'
                ? 'This email is already registered.'
                : (data?.error ?? 'Something went wrong. Try again.'))
        )
        setLoading(false)
        return
      }
      const login = await signIn('credentials', { email, password, deviceId, redirect: false })
      setLoading(false)
      if (login?.error) {
        router.push('/login')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Network error. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-onyx px-6 py-16 text-pearl">
      <div className="amb" aria-hidden="true" />

      <div className="relative z-[2] grid w-full max-w-4xl gap-10 md:grid-cols-[1fr_1.1fr] md:items-center">
        {/* Left pitch */}
        <div className="hidden md:block">
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Start clipping free</p>
          <h2 className="display-lg mt-4">
            A week of clips from <span className="italic-accent gold-text">one paste.</span>
          </h2>
          <ul className="mt-8 space-y-3.5">
            {['40 free credits — no card required', 'All 15 caption styles unlocked', 'Campaign ledger from day one'].map(
              (item) => (
                <li key={item} className="flex items-center gap-3 text-sm font-light text-mist">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-hair text-champagne">
                    <Check className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              )
            )}
          </ul>
        </div>

        {/* Form card */}
        <div className="rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.05] to-pearl/[0.01] p-9 backdrop-blur-xl">
          <Link href="/" className="mb-8 flex justify-center md:hidden" aria-label="NOLOGY home">
            <Wordmark size={26} />
          </Link>

          <h1 className="display-md">Create your account</h1>
          <p className="mt-2 rounded-lg border border-hair bg-surface px-4 py-2.5 text-xs leading-relaxed text-mist-2">
            Preview build — accounts activate once the backend goes live.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-light text-mist">Name</label>
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
                placeholder="At least 8 characters"
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start free — 40 credits'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm font-light text-mist">
            Already have an account?{' '}
            <Link href="/login" className="text-gold underline underline-offset-4 hover:text-champagne">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
