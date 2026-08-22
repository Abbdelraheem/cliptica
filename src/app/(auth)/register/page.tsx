'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Scissors, Loader2, Check } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Something went wrong. Try again.')
        setLoading(false)
        return
      }
      const login = await signIn('credentials', { email, password, redirect: false })
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
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Join the atelier</p>
          <h2 className="display-lg mt-4">
            A week of paid clips from <span className="italic-accent gold-text">one paste.</span>
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
          <Link href="/" className="mb-8 flex items-center justify-center gap-2.5 md:hidden" aria-label="Cliptica home">
            <span className="flex h-7 w-7 rotate-45 items-center justify-center rounded-[6px] bg-gradient-to-br from-gold to-emerald-deep">
              <Scissors className="h-3.5 w-3.5 -rotate-45 text-onyx" />
            </span>
            <span className="font-display text-xl font-semibold">Cliptica</span>
          </Link>

          <h1 className="display-md">Create your account</h1>

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
              <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">
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
