'use client'

import Link from 'next/link'
import { Plus, Sparkles } from 'lucide-react'

const PROJECTS = [
  { name: 'Podcast ep. 42 — growth tactics', clips: 9, score: 84, minutes: 62, status: 'Ready', date: 'Aug 18' },
  { name: 'Webinar — pricing psychology', clips: 6, score: 71, minutes: 48, status: 'Processing', date: 'Aug 16' },
  { name: 'Interview — founder story', clips: 12, score: 88, minutes: 74, status: 'Ready', date: 'Aug 12' },
  { name: 'Keynote — product launch', clips: 7, score: 65, minutes: 39, status: 'Queued', date: 'Aug 10' },
  { name: 'Masterclass — editing craft', clips: 15, score: 91, minutes: 96, status: 'Ready', date: 'Aug 6' },
]

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Library</p>
          <h1 className="display-md mt-2.5">Projects</h1>
        </div>
        <Link href="/dashboard/projects/new" className="btn-lux btn-gold !py-3">
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* New project tile */}
        <Link
          href="/dashboard/projects/new"
          className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hair/60 text-mist transition-all hover:border-champagne hover:text-gold"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-hair">
            <Plus className="h-5 w-5" />
          </span>
          <span className="text-sm font-light">Paste a link or upload</span>
        </Link>

        {PROJECTS.map((p) => (
          <Link
            key={p.name}
            href="/dashboard/projects"
            className="glass-card group !p-0 transition-transform duration-300 hover:-translate-y-1"
          >
            {/* Thumbnail */}
            <div className="relative h-36 overflow-hidden rounded-t-[17px] bg-gradient-to-br from-emerald-deep/40 via-onyx-2 to-champagne/10">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-pearl/50 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                  <Sparkles className="h-4 w-4 text-gold" />
                </span>
              </div>
              <span className="absolute right-3 top-3 font-display text-lg italic text-gold">{p.score}%</span>
            </div>

            <div className="p-5">
              <h3 className="truncate font-medium">{p.name}</h3>
              <div className="mt-2.5 flex items-center justify-between text-xs font-light text-mist">
                <span>{p.clips} clips · {p.minutes} min</span>
                <span>{p.date}</span>
              </div>
              <span
                className={`mt-3 inline-block rounded-full px-3 py-1 text-[10px] uppercase tracking-widest ${
                  p.status === 'Ready'
                    ? 'bg-emerald-deep/30 text-emerald-300'
                    : p.status === 'Processing'
                      ? 'bg-champagne/15 text-champagne'
                      : 'bg-pearl/5 text-mist'
                }`}
              >
                {p.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
