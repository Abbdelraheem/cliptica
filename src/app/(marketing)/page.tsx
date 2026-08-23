'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Play,
  Flame,
  Zap,
  Target,
  Scissors,
  Captions,
  ScanFace,
  Sparkles,
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Youtube,
  Wand2,
  Gauge,
  Layers,
  Palette,
  Share2,
} from 'lucide-react'
import { MarketingLayout } from '@/components/marketing-layout'

/* ---------------- shared bits ---------------- */

function CountUp({
  end,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1700,
}: {
  end: number
  decimals?: number
  prefix?: string
  suffix?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [val, setVal] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        const t0 = performance.now()
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration)
          setVal(end * (1 - Math.pow(1 - p, 3)))
          if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [end, duration])

  return (
    <span ref={ref}>
      {prefix}
      {val.toLocaleString('en-US', {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}

const DEMO_URLS = [
  'youtube.com/watch?v=podcast-ep-42',
  'youtube.com/watch?v=interview-live',
  'twitch.tv/vod/stream-highlights',
]

function PasteBar() {
  const [text, setText] = useState('')
  const [urlIdx, setUrlIdx] = useState(0)

  useEffect(() => {
    let char = 0
    let deleting = false
    const id = setInterval(() => {
      const full = DEMO_URLS[urlIdx]
      if (!deleting) {
        char++
        setText(full.slice(0, char))
        if (char >= full.length) {
          deleting = true
          setTimeout(() => {}, 1400)
        }
      } else {
        char -= 3
        if (char <= 0) {
          deleting = false
          setUrlIdx((i) => (i + 1) % DEMO_URLS.length)
        }
        setText(full.slice(0, Math.max(0, char)))
      }
    }, 55)
    return () => clearInterval(id)
  }, [urlIdx])

  return (
    <div className="input-lux flex items-center gap-3 !rounded-2xl !py-2 pl-5 pr-2">
      <Youtube className="h-5 w-5 shrink-0 text-champagne" />
      <span className="min-w-0 flex-1 truncate font-mono text-sm text-mist">
        https://{text}
        <span className="cursor-blink">|</span>
      </span>
      <Link
        href="/register"
        className="btn-lux btn-primary shrink-0 !rounded-xl !px-5 !py-2.5 !text-sm"
      >
        Get Clips
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 90
      ? 'border-[#ff5a1f]/50 bg-[#ff5a1f]/15 text-[#ffb27a]'
      : score >= 80
        ? 'border-white/15 bg-white/[0.06] text-mist'
        : 'border-white/10 bg-white/[0.04] text-mist-2'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${tone}`}
    >
      <Flame className="h-3 w-3" />
      {score}
    </span>
  )
}

/* Vertical clip mock */
function ClipCard({
  title,
  score,
  dur,
  caption,
  reason,
  delay,
}: {
  title: string
  score: number
  dur: string
  caption: string
  reason: string
  delay: number
}) {
  return (
    <div
      className="glass-card group relative overflow-hidden rounded-2xl p-3"
      style={{ animation: `floaty 6s ease-in-out ${delay}s infinite` }}
    >
      <div className="relative mb-3 aspect-[9/14] overflow-hidden rounded-xl border border-hair bg-gradient-to-b from-[#141414] to-[#0b0b0b]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-champagne/60 to-transparent" />
        {/* face box */}
        <div className="scanface absolute left-1/2 top-[22%] h-16 w-16 -translate-x-1/2 rounded-lg border-2 border-champagne/70" />
        {/* caption line */}
        <div className="absolute inset-x-3 bottom-8 text-center">
          <span className="inline-block rounded-md bg-black/70 px-2 py-1 font-display text-[13px] font-extrabold uppercase tracking-wide text-white shadow-lg">
            {caption}
          </span>
        </div>
        {/* progress */}
        <div className="absolute inset-x-4 bottom-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 rounded-full bg-gold" />
        </div>
        <Play className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-white/25 transition group-hover:text-champagne" />
      </div>
      <div className="flex items-center justify-between gap-2 px-1 pb-1">
        <p className="truncate text-xs font-semibold text-pearl">{title}</p>
        <ScoreBadge score={score} />
      </div>
      <p className="truncate px-1 pb-1 font-mono text-[10px] text-mist-2">{dur}</p>
      <p className="flex items-start gap-1 px-1 text-[10px] leading-snug text-mist-2">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-champagne" />
        {reason}
      </p>
    </div>
  )
}

/* ---------------- sections ---------------- */

function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 pt-36 lg:pt-44">
      <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="eyebrow rv in">AI Clipping Engine</p>
          <h1 className="display-xl mt-5 leading-[1.02]">
            One video in.
            <br />
            A week of <span className="gold-text">clips</span> out.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-mist">
            Paste a YouTube link. Nology finds the viral moments, cuts them vertical with
            face-tracking, burns word-perfect captions, and hands you ready-to-post shorts —
            with a score explaining why each one will pop.
          </p>

          <div className="mt-8 max-w-lg">
            <PasteBar />
            <p className="mt-3 flex items-center gap-2 text-xs text-mist-2">
              <Check className="h-3.5 w-3.5 text-champagne" /> 40 free credits — no card required
              <span className="mx-1 opacity-40">·</span> ~4 min per hour of video
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-4">
            {[
              { v: <CountUp end={12} suffix="k+" />, l: 'clips rendered' },
              { v: <CountUp end={94} suffix="/100" />, l: 'avg top score' },
              { v: <CountUp end={9} suffix=" min" />, l: 'median turnaround' },
            ].map((s) => (
              <div key={s.l}>
                <p className="stat-value text-2xl">{s.v}</p>
                <p className="mt-0.5 text-xs text-mist-2">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard mock */}
        <div className="relative rv in">
          <div className="pointer-events-none absolute -inset-10 rounded-full bg-[#ff5a1f]/[0.07] blur-3xl" />
          <div className="glass-card relative rounded-3xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-champagne">Project</p>
                <p className="mt-1 text-sm font-bold text-pearl">Podcast Ep. 42 — 58:12</p>
              </div>
              <span className="pill !bg-[#ff5a1f]/10 !text-[#ffb27a]">
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#ff5a1f]" />
                Complete · 6 clips
              </span>
            </div>

            <div className="mb-5 space-y-2.5 rounded-2xl border border-hair bg-black/30 p-4">
              {[
                ['Transcribing audio', 100],
                ['Scoring 214 moments', 100],
                ['Rendering 9:16 crops', 100],
              ].map(([label, pct]) => (
                <div key={label as string}>
                  <div className="mb-1 flex justify-between text-[11px] text-mist-2">
                    <span>{label}</span>
                    <span className="font-mono">{pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#E8430A] to-[#FFB27A]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <ClipCard
                title="The $40M mistake"
                score={94}
                dur="00:34"
                caption="NOBODY TELLS YOU THIS"
                reason="Strong hook + emotional peak at 12:04"
                delay={0}
              />
              <ClipCard
                title="Why we almost quit"
                score={88}
                dur="00:47"
                caption="WE LOST EVERYTHING"
                reason="Story arc with retention spike at 31:20"
                delay={1.2}
              />
              <ClipCard
                title="Hiring at 3AM"
                score={81}
                dur="00:29"
                caption="BEST ADVICE EVER"
                reason="Quotable punchline, high shareability"
                delay={2.4}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function FactTicker() {
  const facts = [
    'FACE-TRACKED 9:16 CROPS',
    'VIRAL SCORES WITH REASONS',
    'WORD-PERFECT CAPTIONS',
    'GPT MOMENT DETECTION',
    '15 CAPTION STYLES',
    'READY IN MINUTES, NOT HOURS',
    'MULTI-PLATFORM EXPORTS',
  ]
  const row = [...facts, ...facts]
  return (
    <section className="mt-28 border-y border-hair/60 bg-[#080808] py-5">
      <div className="ticker">
        <div className="ticker-track">
          {[0, 1].map((half) => (
            <div key={half} className="flex shrink-0 items-center" aria-hidden={half === 1}>
              {row.map((f, i) => (
                <span
                  key={`${half}-${i}`}
                  className="mx-6 flex items-center gap-3 whitespace-nowrap font-display text-xs font-extrabold tracking-[0.3em] text-mist-2"
                >
                  <Zap className="h-3.5 w-3.5 text-champagne" />
                  {f}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    icon: Youtube,
    title: 'Paste your link',
    body: 'Drop any YouTube URL or upload a file. Nology pulls the video and builds a transcription within seconds.',
    tag: 'STEP 01',
  },
  {
    icon: Target,
    title: 'AI hunts the moments',
    body: 'The engine reads every second — hooks, emotional peaks, punchlines — and scores each candidate moment out of 100, with the reason written out.',
    tag: 'STEP 02',
  },
  {
    icon: Scissors,
    title: 'Auto-edit to vertical',
    body: 'Clips are cropped to 9:16 with the speaker’s face locked in frame, captions burned in word-by-word, and motion polish applied.',
    tag: 'STEP 03',
  },
  {
    icon: Share2,
    title: 'Post everywhere',
    body: 'Download clean MP4s sized for TikTok, Reels, and Shorts. Track what you posted and watch the views stack up in your ledger.',
    tag: 'STEP 04',
  },
]

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-28 px-6 pt-28">
      <p className="eyebrow rv">How It Works</p>
      <h2 className="display-md mt-4 max-w-xl rv">
        From raw footage to posted shorts in{' '}
        <span className="gold-text">four moves</span>
      </h2>
      <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            className="glass-card group relative overflow-hidden rounded-3xl p-6 rv"
            style={{ transitionDelay: `${i * 90}ms` }}
          >
            <span className="absolute -right-3 -top-5 font-display text-7xl font-extrabold text-white/[0.04]">
              {i + 1}
            </span>
            <span className="icon-gem flex h-11 w-11 items-center justify-center rounded-2xl">
              <s.icon className="h-5 w-5 text-champagne" />
            </span>
            <p className="mt-6 font-mono text-[10px] tracking-[0.25em] text-mist-2">{s.tag}</p>
            <h3 className="mt-2 font-display text-lg font-extrabold text-pearl">{s.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-mist">{s.body}</p>
            {i < STEPS.length - 1 && (
              <ArrowRight className="absolute -right-2 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-champagne/40 xl:block" />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

const FEATURES = [
  {
    icon: Gauge,
    name: 'Viral Score™',
    desc: 'Every candidate moment gets a 0–100 score for hook strength, retention risk, and shareability — plus a plain-English reason so you know exactly why it was picked.',
    span: 'md:col-span-2',
  },
  {
    icon: Captions,
    name: 'Word-perfect captions',
    desc: 'Word-level timing from Whisper means captions land on the exact syllable. 15 styles from clean to beast-mode.',
    span: '',
  },
  {
    icon: ScanFace,
    name: 'Face-tracked 9:16',
    desc: 'The crop follows the speaker automatically. Two-shot conversations get smart speaker switching.',
    span: '',
  },
  {
    icon: Wand2,
    name: 'Motion polish',
    desc: 'Auto zoom-punches, B-roll beats, and emphasis pops applied from 22 motion templates.',
    span: '',
  },
  {
    icon: Palette,
    name: 'Brand kit',
    desc: 'Your fonts, colors, and caption style saved once — applied to every future project by default.',
    span: '',
  },
  {
    icon: Layers,
    name: 'Campaign ledger',
    desc: 'Log which clip went to which platform, keep a posting calendar, and see pending vs paid earnings per campaign.',
    span: 'md:col-span-2',
  },
]

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-28 px-6 pt-28">
      <p className="eyebrow rv">Inside The Engine</p>
      <h2 className="display-md mt-4 max-w-2xl rv">
        An editor that works while <span className="gold-text">you sleep</span>
      </h2>
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <div
            key={f.name}
            className={`glass-card group rounded-3xl p-7 rv ${f.span}`}
            style={{ transitionDelay: `${(i % 3) * 90}ms` }}
          >
            <span className="icon-gem flex h-11 w-11 items-center justify-center rounded-2xl">
              <f.icon className="h-5 w-5 text-champagne" />
            </span>
            <h3 className="mt-5 font-display text-lg font-extrabold text-pearl">{f.name}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-mist">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function TimeCompare() {
  const oldTasks: [string, number][] = [
    ['Watching the full video', 95],
    ['Finding the moments', 80],
    ['Cutting + reframing to 9:16', 75],
    ['Captioning by hand', 90],
    ['Exporting for each app', 35],
  ]
  return (
    <section className="mx-auto max-w-6xl px-6 pt-28">
      <div className="glass-card relative overflow-hidden rounded-[2rem] p-8 md:p-12 rv">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#ff5a1f]/10 blur-3xl" />
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">The Math</p>
            <h2 className="display-md mt-4">
              <span className="gold-text">
                <CountUp end={8} suffix=" hours" />
              </span>{' '}
              becomes{' '}
              <span className="gold-text">
                <CountUp end={20} suffix=" min" />
              </span>
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-mist">
              One podcast episode. The old way, you scrub, cut, reframe, and caption until
              midnight — for maybe two clips. Nology returns six scored, captioned, vertical
              clips before your coffee gets cold.
            </p>
            <Link
              href="/register"
              className="btn-lux btn-primary mt-8 inline-flex !rounded-2xl !px-7 !py-3.5"
            >
              Try it free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-6">
            <div className="space-y-3 rounded-2xl border border-hair bg-black/30 p-6">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-mist-2">
                <Clock className="h-3.5 w-3.5" /> Old way
              </p>
              {oldTasks.map(([task, mins]) => (
                <div key={task}>
                  <div className="mb-1 flex justify-between text-xs text-mist">
                    <span>{task}</span>
                    <span className="font-mono text-mist-2">{mins}m</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-white/25"
                      style={{ width: `${(mins / 95) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3 rounded-2xl border border-[#ff5a1f]/40 bg-[#ff5a1f]/[0.06] p-6">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#ffb27a]">
                <Zap className="h-3.5 w-3.5" /> With Nology
              </p>
              {['You paste the link', 'Engine does the rest'].map((task, i) => (
                <div key={task}>
                  <div className="mb-1 flex justify-between text-xs text-pearl">
                    <span>{task}</span>
                    <span className="font-mono text-[#ffb27a]">{i === 0 ? '1m' : '19m'}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#E8430A] to-[#FFB27A]"
                      style={{ width: i === 0 ? '2%' : '18%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const PLANS = [
  {
    name: 'Free',
    price: 0,
    credits: '40 credits / month',
    blurb: 'See the magic on your own footage.',
    features: ['~1 hr of video processed', 'All caption styles', '9:16 face-tracked exports', 'Watermark-free MP4s'],
    cta: 'Start Free',
    featured: false,
  },
  {
    name: 'Creator',
    price: 19,
    credits: '400 credits / month',
    blurb: 'For daily posters building an audience.',
    features: ['~10 hrs of video processed', 'Everything in Free', 'Brand kit + saved presets', 'Campaign ledger & calendar', 'Priority rendering queue'],
    cta: 'Go Creator',
    featured: true,
  },
  {
    name: 'Studio',
    price: 49,
    credits: '1,200 credits / month',
    blurb: 'For teams and agencies at scale.',
    features: ['~30 hrs of video processed', 'Everything in Creator', 'Multiple brand kits', 'Team seats included', 'API access'],
    cta: 'Go Studio',
    featured: false,
  },
]

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-28 px-6 pt-28">
      <p className="eyebrow rv">Pricing</p>
      <h2 className="display-md mt-4 max-w-xl rv">
        Cheaper than <span className="gold-text">one edit</span>
      </h2>
      <p className="mt-4 max-w-lg text-mist rv">
        1 credit ≈ 1 minute of source video. Unused credits roll over for 30 days.
      </p>
      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {PLANS.map((p, i) => (
          <div
            key={p.name}
            className={`rv relative rounded-3xl border p-8 ${
              p.featured
                ? 'border-[#ff5a1f]/50 bg-gradient-to-b from-[#ff5a1f]/[0.08] to-transparent shadow-[0_20px_80px_rgba(255,90,31,0.12)]'
                : 'glass-card'
            }`}
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            {p.featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#ff5a1f] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white">
                Most Popular
              </span>
            )}
            <h3 className="font-display text-sm font-extrabold uppercase tracking-[0.22em] text-champagne">
              {p.name}
            </h3>
            <p className="price-ring mt-5">
              <span className="text-5xl font-extrabold">${p.price}</span>
              <span className="text-mist-2"> /mo</span>
            </p>
            <p className="mt-2 font-mono text-xs text-mist-2">{p.credits}</p>
            <p className="mt-4 text-sm text-mist">{p.blurb}</p>
            <ul className="mt-6 space-y-3">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-mist">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-champagne" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className={`btn-lux mt-8 flex w-full items-center justify-center !rounded-2xl !py-3.5 ${
                p.featured ? 'btn-primary' : 'btn-outline'
              }`}
            >
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

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
    'Credits are consumed per minute of source video when a project runs. Failed renders are automatically refunded to your balance.',
  ],
  [
    'Do you support languages other than English?',
    'Transcription and captions currently work best in English, with early support for Spanish, Arabic, French, and German.',
  ],
]

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-28 px-6 pt-28">
      <p className="eyebrow rv">FAQ</p>
      <h2 className="display-md mt-4 rv">Questions, answered</h2>
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
    </section>
  )
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-28">
      <div className="glass-card relative overflow-hidden rounded-[2.5rem] px-8 py-20 text-center rv">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-[#ff5a1f]/15 blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-[#ff7a3d]/10 blur-3xl" />
        </div>
        <p className="eyebrow relative">Ready When You Are</p>
        <h2 className="display-md relative mx-auto mt-5 max-w-2xl">
          Your next <span className="gold-text">million views</span> are already inside your last
          upload
        </h2>
        <p className="relative mx-auto mt-5 max-w-md text-mist">
          Start free with 40 credits. Paste one link and watch the clips come back scored,
          captioned, and ready to post.
        </p>
        <div className="relative mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="btn-lux btn-primary inline-flex !rounded-2xl !px-8 !py-4 !text-base"
          >
            Start Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#how" className="btn-lux btn-outline inline-flex !rounded-2xl !px-8 !py-4 !text-base">
            See How It Works
          </a>
        </div>
        <p className="relative mt-6 text-xs text-mist-2">
          No credit card required · Cancel anytime
        </p>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <MarketingLayout>
      <style>{`
        @keyframes floaty {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        @keyframes scanpulse {
          0%, 100% { opacity: 0.5; transform: translate(-50%, 0); }
          50% { opacity: 1; transform: translate(-50%, 4px); }
        }
        .scanface { animation: scanpulse 2.6s ease-in-out infinite; }
      `}</style>
      <Hero />
      <FactTicker />
      <HowItWorks />
      <Features />
      <TimeCompare />
      <Pricing />
      <Faq />
      <FinalCta />
    </MarketingLayout>
  )
}
