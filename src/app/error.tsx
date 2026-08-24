'use client'

import { useEffect } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error)
  }, [error])

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-onyx px-6 text-center text-pearl">
      <div className="amb" aria-hidden="true" />

      <div className="relative z-[2] max-w-md">
        <p className="text-xs uppercase tracking-[0.3em] text-champagne">Something broke</p>
        <h1 className="display-lg mt-4 flex items-center justify-center gap-3">
          <TriangleAlert className="h-7 w-7 text-gold" />
          An unexpected error occurred
        </h1>
        <p className="mt-4 text-sm font-light leading-relaxed text-mist-2">
          We hit a snag while loading this part of the studio. Retrying usually fixes it — if it
          keeps happening, come back in a few minutes.
        </p>
        {error.digest && (
          <p className="mt-4 text-xs tracking-wide text-mist-2/60">Reference: {error.digest}</p>
        )}

        <div className="mt-9 flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-lux btn-gold">
            <RotateCcw className="mr-2 h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
