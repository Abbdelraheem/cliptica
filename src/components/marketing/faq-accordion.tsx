'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQS: [string, string][] = [
  [
    'How long does a video take to process?',
    'Roughly 4 minutes per hour of source video on our standard queue — a 1-hour podcast is usually done in under 5 minutes. Creator and Studio plans render on a priority queue.',
  ],
  [
    'What sources can I use?',
    'Paste any public YouTube link, or upload your own files (MP4, MOV, MKV). You must own the rights to the footage you process.',
  ],
  [
    'How accurate are the Viral Scores?',
    'Scores blend hook strength, pacing, emotion, and payoff signals measured across millions of short-form videos. They are a prioritization tool — the reasons tell you why each moment was picked so you can make the final call fast.',
  ],
  [
    'Can I edit the clips after generation?',
    'Yes — adjust trim points, swap caption style, or regenerate a single clip without re-processing the whole video.',
  ],
  [
    'What do credits get spent on?',
    'Credits are consumed per final video clip generated when a project runs. Failed renders are automatically refunded to your balance.',
  ],
  [
    'Do you support languages other than English?',
    'Transcription and captions currently work best in English, with early support for Spanish, Arabic, French, and German.',
  ],
]

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="mt-12 space-y-3">
      {FAQS.map(([q, a], i) => (
        <div
          key={q}
          className={`glass-card overflow-hidden rounded-2xl transition-all duration-300 rv ${
            open === i ? '!border-champagne/30' : ''
          }`}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 p-5 text-left"
            aria-expanded={open === i}
          >
            <span className="font-display text-sm font-bold text-pearl sm:text-base">{q}</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-champagne transition-transform duration-300 ${
                open === i ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div
            className="grid transition-all duration-300"
            style={{ gridTemplateRows: open === i ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <p className="px-5 pb-5 text-sm leading-relaxed text-mist">{a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
