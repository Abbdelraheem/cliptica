'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, ShieldAlert } from 'lucide-react'
import { Wordmark } from '@/components/logo'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Something went wrong. Please try again.')
        return
      }
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <>
        <p className="text-xs uppercase tracking-[0.3em] text-champagne">Invalid link</p>
        <h1 className="display-md mt-3">This reset link is missing its token</h1>
        <p className="mt-4 rounded-lg border border-hair bg-surface px-4 py-2.5 text-xs leading-relaxed text-mist-2">
          Request a fresh link from the forgot-password page.
        </p>
      </>
    )
  }

  if (done) {
    return (
      <>
        <p className="text-xs uppercase tracking-[0.3em] text-champagne">All set</p>
        <h1 className="display-md mt-3">Password updated</h1>
        <p className="mt-4 rounded-lg border border-hair bg-surface px-4 py-2.5 text-xs leading-relaxed text-mist-2">
          Redirecting you to the log in page…
        </p>
      </>
    )
  }

  return (
    <>
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">New password</p>
      <h1 className="display-md mt-3">Choose a new password</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-light text-mist">New password</label>
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
        <div>
          <label htmlFor="confirm" className="mb-2 block text-sm font-light text-mist">Confirm new password</label>
          <input
            id="confirm"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-onyx px-6 text-pearl">
      <div className="amb" aria-hidden="true" />

      <div className="relative z-[2] w-full max-w-md">
        <Link href="/" className="mb-10 flex justify-center" aria-label="NOLOGY home">
          <Wordmark size={30} />
        </Link>

        <div className="rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.05] to-pearl/[0.01] p-9 backdrop-blur-xl">
          <Suspense fallback={<div className="h-40" />}>
            <ResetPasswordForm />
          </Suspense>

          <p className="mt-7 text-center text-sm font-light text-mist">
            <Link href="/login" className="text-gold underline underline-offset-4 hover:text-champagne">
              Back to log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
