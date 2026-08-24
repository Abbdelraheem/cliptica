import Link from 'next/link'
import { Wordmark } from '@/components/logo'

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-onyx px-6 text-center text-pearl">
      <div className="amb" aria-hidden="true" />

      <div className="relative z-[2]">
        <Link href="/" className="mb-10 inline-flex" aria-label="NOLOGY home">
          <Wordmark size={30} />
        </Link>

        <p className="text-xs uppercase tracking-[0.3em] text-champagne">Error 404</p>
        <h1 className="display-lg mt-4">This scene didn&apos;t make the cut</h1>
        <p className="mx-auto mt-4 max-w-md text-sm font-light leading-relaxed text-mist-2">
          The page you&apos;re looking for doesn&apos;t exist or was moved. Let&apos;s get you
          back to the studio.
        </p>

        <div className="mt-9 flex items-center justify-center gap-3">
          <Link href="/" className="btn-lux btn-gold">
            Back to home
          </Link>
          <Link href="/dashboard" className="btn-lux btn-outline">
            Open dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
