'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, MailCheck } from 'lucide-react'
import { Wordmark } from '@/components/logo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Something went wrong. Please try again.')
        return
      }
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-onyx px-6 text-pearl">
      <div className="amb" aria-hidden="true" />

      <div className="relative z-[2] w-full max-w-md">
        <Link href="/" className="mb-10 flex justify-center" aria-label="NOLOGY home">
          <Wordmark size={30} />
        </Link>

        <div className="rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.05] to-pearl/[0.01] p-9 backdrop-blur-xl">
          {sent ? (
            <>
              <p className="text-xs uppercase tracking-[0.3em] text-champagne">Check your inbox</p>
              <h1 className="display-md mt-3">Reset link sent</h1>
              <p className="mt-4 flex items-start gap-2 rounded-lg border border-hair bg-surface px-4 py-2.5 text-xs leading-relaxed text-mist-2">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                If an account exists for {email}, you&apos;ll receive a link to choose a new
                password. It expires in one hour.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.3em] text-champagne">Password help</p>
              <h1 className="display-md mt-3">Forgot your password?</h1>

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

                {error && (
                  <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={loading} className="btn-lux btn-gold w-full disabled:opacity-60">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
                </button>
              </form>
            </>
          )}

          <p className="mt-7 text-center text-sm font-light text-mist">
            Remembered it?{' '}
            <Link href="/login" className="text-gold underline underline-offset-4 hover:text-champagne">
              Back to log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
