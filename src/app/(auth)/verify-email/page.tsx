'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, MailWarning } from 'lucide-react'
import { Wordmark } from '@/components/logo'

function VerifyEmailInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [state, setState] = useState<'verifying' | 'success' | 'failed' | 'resend'>(
    token ? 'verifying' : 'resend'
  )
  const [email, setEmail] = useState('')
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        if (cancelled) return
        setState(res.ok ? 'success' : 'failed')
      } catch {
        if (!cancelled) setState('failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleResend(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setResent(true)
    } catch {
      /* generic — nothing to surface */
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {state === 'verifying' && (
        <>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">One moment</p>
          <h1 className="display-md mt-3 flex items-center gap-3">
            Verifying your email <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </h1>
        </>
      )}

      {state === 'success' && (
        <>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Confirmed</p>
          <h1 className="display-md mt-3">Email verified</h1>
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-hair bg-surface px-4 py-2.5 text-xs leading-relaxed text-mist-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            Your account is active. Head over to the log in page to continue.
          </p>
        </>
      )}

      {state === 'failed' && (
        <>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Link problem</p>
          <h1 className="display-md mt-3">This link is invalid or expired</h1>
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-hair bg-surface px-4 py-2.5 text-xs leading-relaxed text-mist-2">
            <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            Request a new verification email below.
          </p>
        </>
      )}

      {(state === 'failed' || state === 'resend') && (
        <form onSubmit={handleResend} className="mt-8 space-y-4">
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

          {resent ? (
            <p className="rounded-lg border border-hair bg-surface px-4 py-2.5 text-sm text-mist-2">
              If that account needs verification, a new link has been sent.
            </p>
          ) : null}

          <button type="submit" disabled={loading || resent} className="btn-lux btn-gold w-full disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : resent ? 'Link sent' : 'Resend verification link'}
          </button>
        </form>
      )}
    </>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-onyx px-6 text-pearl">
      <div className="amb" aria-hidden="true" />

      <div className="relative z-[2] w-full max-w-md">
        <Link href="/" className="mb-10 flex justify-center" aria-label="NOLOGY home">
          <Wordmark size={30} />
        </Link>

        <div className="rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.05] to-pearl/[0.01] p-9 backdrop-blur-xl">
          <Suspense fallback={<div className="h-40" />}>
            <VerifyEmailInner />
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
