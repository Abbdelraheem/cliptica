'use client'

import { useEffect } from 'react'
import { RotateCcw, TriangleAlert, Home } from 'lucide-react'
import { reportError } from '@/lib/monitoring'

export default function RootGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Fatal root application error:', error)
    reportError(error, { digest: error.digest, fatal: true })
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 py-8 text-center text-white font-sans antialiased">
        <div className="relative z-10 max-w-md rounded-3xl border border-white/10 bg-[#0d0d0d] p-8 shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#ff5a1f]/30 bg-[#ff5a1f]/10 text-[#ff5a1f]">
            <TriangleAlert className="h-7 w-7" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#ffb27a]">
            System Exception
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
            Application Interrupted
          </h1>
          <p className="mt-3 text-sm font-light leading-relaxed text-white/70">
            A critical error prevented this page from rendering. Retrying reinitializes the application state.
          </p>

          {error.digest && (
            <p className="mt-4 font-mono text-[11px] text-white/40">
              Reference ID: {error.digest}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#e8430a] to-[#ff5a1f] px-5 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Try again
            </button>
            <button
              onClick={() => {
                window.location.href = '/'
              }}
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-5 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            >
              <Home className="mr-2 h-4 w-4" />
              Return Home
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
