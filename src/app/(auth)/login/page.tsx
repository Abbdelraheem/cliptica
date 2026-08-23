'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Wordmark } from '@/components/logo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      setError('Invalid email or password.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-onyx px-6 text-pearl">
      <div className="amb" aria-hidden="true" />

      <div className="relative z-[2] w-full max-w-md">
        <Link href="/" className="mb-10 flex justify-center" aria-label="ClipForge home">
          <Wordmark size={30} />
        </Link>

        <div className="rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.05] to-pearl/[0.01] p-9 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Welcome back</p>
          <h1 className="display-md mt-3">Welcome back, creator</h1>

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
              <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-lux btn-gold w-full disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log in'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-hair/40" />
            <span className="text-xs uppercase tracking-widest text-mist-2">or</span>
            <span className="h-px flex-1 bg-hair/40" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
              className="btn-lux btn-outline !py-3 !text-sm"
            >
              Google
            </button>
            <button
              onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
              className="btn-lux btn-outline !py-3 !text-sm"
            >
              GitHub
            </button>
          </div>

          <p className="mt-7 text-center text-sm font-light text-mist">
            New to ClipForge?{' '}
            <Link href="/register" className="text-gold underline underline-offset-4 hover:text-champagne">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
