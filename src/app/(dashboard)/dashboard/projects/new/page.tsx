'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Link2, Upload, Loader2, Sparkles } from 'lucide-react'

export default function NewProjectPage() {
  const [url, setUrl] = useState('')
  const [instructions, setInstructions] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // TODO: POST /api/projects
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">New project</p>
      <h1 className="display-md mt-2.5">
        Drop in the <span className="italic-accent gold-text">long video</span>
      </h1>
      <p className="mt-3 font-light text-mist">
        Paste a link or upload a file. Add clipping instructions and the AI clips toward them.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-6 rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.05] to-pearl/[0.01] p-8 backdrop-blur-xl">
        {/* Source */}
        <div>
          <label htmlFor="url" className="mb-2.5 block text-sm font-light text-mist">Video link</label>
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-2" />
            <input
              id="url"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              className="input-lux !pl-11"
            />
          </div>
        </div>

        {/* Upload alternative */}
        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-hair/40" />
          <span className="text-xs uppercase tracking-widest text-mist-2">or</span>
          <span className="h-px flex-1 bg-hair/40" />
        </div>

        <button
          type="button"
          className="flex w-full flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-hair/60 py-9 text-mist transition-colors hover:border-champagne hover:text-gold"
        >
          <Upload className="h-5 w-5" />
          <span className="text-sm font-light">Upload a file — up to 90 minutes</span>
        </button>

        {/* Instructions */}
        <div>
          <label htmlFor="instructions" className="mb-2.5 block text-sm font-light text-mist">
            Clipping instructions <span className="text-mist-2">(optional)</span>
          </label>
          <textarea
            id="instructions"
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Focus on the pricing debate and the founder story. Skip the intro."
            className="input-lux resize-none"
          />
        </div>

        {/* Cost estimate */}
        <div className="flex items-center justify-between rounded-xl border border-hair/50 bg-onyx-2/60 px-5 py-4">
          <span className="text-sm font-light text-mist">Estimated cost</span>
          <span className="font-display text-xl italic text-gold">~62 credits</span>
        </div>

        <button type="submit" disabled={loading} className="btn-lux btn-gold w-full !py-4 disabled:opacity-60">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Find the moments worth posting
            </>
          )}
        </button>

        <p className="text-center text-xs font-light text-mist-2">
          By submitting you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-gold">terms</Link>.
        </p>
      </form>
    </div>
  )
}
