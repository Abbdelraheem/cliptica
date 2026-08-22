'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MarketingLayout } from '@/components/marketing-layout'
import {
  Scissors,
  TrendingUp,
  Layout,
  DollarSign,
  Clock,
  Sparkles,
  Award,
  Users,
  Shield,
  Zap,
  Video,
} from 'lucide-react'

const CLIP_STYLES = [
  'BEAST MODE', 'KINETIC', 'CLEAN', 'TIKTOK NATIVE', 'MINIMAL',
  'BOLD OUTLINE', 'HIGHLIGHT', 'KARAOKE', 'NEON', 'GRADIENT',
  'RETRO', 'GLAM', 'MONO', 'POP',
]

const FEATURES = [
  { icon: Sparkles, num: '01', title: 'AI Auto Editor', desc: 'One paste → finished clips. Cinematic color, animated motion graphics, B-roll, sound design, word-perfect captions, speaker-locked reframe.' },
  { icon: TrendingUp, num: '02', title: 'Moments worth posting', desc: 'Cliptica reviews the whole video, ranks every potential moment, and surfaces just the ones worth your time — each with a score.' },
  { icon: Layout, num: '03', title: 'Full timeline editor', desc: "Every clip arrives dressed. When you want control, it's a real inspector — 15 caption styles, face-tracked reframe, free re-renders." },
  { icon: DollarSign, num: '04', title: 'Campaign ledger', desc: 'Link every post to its campaign, log views and payouts, watch effective $/1K by program. Pending → approved → paid.' },
  { icon: Clock, num: '05', title: '20× faster', desc: 'Same four clips: 8 hours by hand vs 20 minutes with Cliptica. Paste → AI finds, cuts, reframes, captions, scores.' },
  { icon: Video, num: '06', title: 'Built for the economy', desc: 'Content Rewards pays $40K+/day across ~1M videos/month. Short-form ad spend: $111B → $145.8B by 2028. Throughput wins.' },
]

const STEPS = [
  { n: '01', title: 'Drop in the long video', desc: 'Upload or paste a link. Add clipping instructions and the AI clips toward them.' },
  { n: '02', title: 'Only the moments worth posting', desc: 'Every potential clip ranked, surfaced with a viral score and explanation.' },
  { n: '03', title: 'Every clip leaves edited', desc: 'Face-tracked 9:16, animated captions, headline, music bed, SFX, zoom punch-ins.' },
  { n: '04', title: 'The ledger keeps the books', desc: 'Link posts to campaigns, log views and payouts, watch effective $/1K live.' },
]

const PLANS = [
  {
    name: 'Free', price: '$0', period: '/ forever', feat: false,
    items: ['40 credits to start', 'All 15 caption styles', '720p exports with mark', 'Up to 3 videos / day'],
    cta: 'Start free', href: '/register',
  },
  {
    name: 'Clipper', price: '$19', period: '/ mo', feat: true,
    items: ['300 credits / month', 'No watermark · 1080p 60fps', 'Campaign hub + earnings ledger', 'Motion graphics, music & SFX'],
    cta: 'Get Clipper', href: '/register?plan=clipper',
  },
  {
    name: 'Studio', price: '$49', period: '/ mo', feat: false,
    items: ['1,200 credits / month', 'Priority rendering queue', 'Auto-Pilot watchlists', 'Brand presets & style packs'],
    cta: 'Get Studio', href: '/register?plan=studio',
  },
]

/* ---------- Rotating 3D ring of clip cards ---------- */
function ClipRing() {
  const ringRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ring = ringRef.current
    if (!ring) return
    if (ring.childElementCount === 0) {
      const N = 14
      const R = 460
      for (let i = 0; i < N; i++) {
        const card = document.createElement('div')
        card.className =
          'absolute h-[255px] w-[150px] overflow-hidden rounded-2xl border border-hair bg-gradient-to-b from-onyx-2/90 to-onyx-2/70 shadow-[0_22px_60px_rgba(0,0,0,0.55)] [backface-visibility:hidden]'
        const ang = (360 / N) * i
        const y = Math.sin(i) * 40
        card.style.transform = `rotateY(${ang}deg) translateZ(${R}px) translateY(${y}px)`
        card.innerHTML = `
          <div class="absolute inset-0" style="background:
            radial-gradient(120% 80% at 30% 18%, rgba(31,81,69,.55), transparent 60%),
            linear-gradient(150deg, rgba(216,182,118,.22), rgba(14,12,16,.2))"></div>
          <div class="absolute right-2.5 top-2.5 font-display text-base italic text-gold">${62 + ((i * 37) % 37)}%</div>
          <div class="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-pearl/60">
            <span style="border-left:9px solid rgba(243,237,225,.75);border-top:6px solid transparent;border-bottom:6px solid transparent;margin-left:2px"></span>
          </div>
          <div class="absolute bottom-2.5 left-2.5 right-2.5 rounded-lg bg-onyx/70 px-2 py-1.5 text-[10px] uppercase tracking-wider text-pearl backdrop-blur-sm">${CLIP_STYLES[i % CLIP_STYLES.length]}</div>
        `
        ring.appendChild(card)
      }
    }

    let raf = 0
    const onScroll = () => {
      if (stageRef.current) {
        const o = Math.max(0, 1 - window.scrollY / window.innerHeight)
        stageRef.current.style.opacity = String(o)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={stageRef} className="pointer-events-none fixed inset-0 z-[1] hidden overflow-hidden md:flex md:items-center md:justify-center" aria-hidden="true">
      <div className="[perspective:1500px] [perspective-origin:50%_44%]">
        <div
          ref={ringRef}
          className="relative h-px w-px blur-[0.6px] [transform-style:preserve-3d] motion-safe:[animation:ringspin_38s_linear_infinite]"
          style={{ ['--tw-ring' as string]: '' }}
        />
      </div>
      <style>{`@keyframes ringspin{to{transform:rotateX(-12deg) rotateY(360deg)}}`}</style>
    </div>
  )
}

/* ---------- Rotating prism ---------- */
function Prism() {
  return (
    <div className="mx-auto my-14 h-[300px] w-[240px] [perspective:1200px]" aria-hidden="true">
      <div className="relative h-full w-full [transform-style:preserve-3d] motion-safe:[animation:prismspin_22s_linear_infinite]">
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <div
            key={deg}
            className="absolute inset-0 border border-hair shadow-[inset_0_0_40px_rgba(216,182,118,0.12)] backdrop-blur-sm"
            style={{
              transform: `rotateY(${deg}deg) translateZ(120px)`,
              background:
                'linear-gradient(160deg, rgba(216,182,118,.16), rgba(31,81,69,.10))',
            }}
          />
        ))}
        <div className="absolute inset-[38%] rounded-full bg-[radial-gradient(circle,var(--gold),transparent_70%)] blur-md" />
      </div>
      <style>{`@keyframes prismspin{to{transform:rotateY(360deg)}}`}</style>
    </div>
  )
}

/* ---------- Count-up stat ---------- */
function Stat({ value, label }: { value: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        io.disconnect()
        const t0 = performance.now()
        const tick = (t: number) => {
          const p = Math.min((t - t0) / 1200, 1)
          setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.5 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [value])

  return (
    <div ref={ref} className="text-center">
      <div className="stat-value">{display}</div>
      <div className="mt-1 text-sm font-light tracking-wide text-mist">{label}</div>
    </div>
  )
}

export default function HomePage() {
  return (
    <MarketingLayout>
      <ClipRing />

      {/* ================= HERO ================= */}
      <section className="flex min-h-screen flex-col items-center justify-center px-6 pb-20 pt-36 text-center">
        <span className="eyebrow rv">New · AI Auto Editor, one gesture</span>

        <h1 className="display-xl rv mt-7 max-w-5xl">
          A week of paid clips
          <br />
          from <span className="italic-accent gold-text">one paste.</span>
        </h1>

        <p className="rv mt-5 max-w-xl text-lg font-light leading-relaxed text-mist">
          Cliptica finds the moments that earn, cuts them like a senior editor, and reframes them to
          vertical — ready to post — while a campaign ledger keeps score of every payout.
        </p>

        <Prism />

        <div className="rv flex flex-wrap justify-center gap-4">
          <Link href="/register" className="btn-lux btn-gold !px-8 !py-4 !text-base">
            Start free — 40 credits
          </Link>
          <Link href="/#how" className="btn-lux btn-outline !px-8 !py-4 !text-base">
            See it on your video
          </Link>
        </div>
      </section>

      {/* ================= TICKER ================= */}
      <div className="ticker relative z-[2]">
        <div className="ticker-track">
          {[...CLIP_STYLES, ...CLIP_STYLES].map((s, i) => (
            <span key={`${s}-${i}`}>{s.charAt(0) + s.slice(1).toLowerCase()}</span>
          ))}
        </div>
      </div>

      {/* ================= FEATURES ================= */}
      <section id="features" className="relative z-[2] mx-auto max-w-6xl px-6 py-24">
        <div className="rv mx-auto mb-14 max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">The Atelier</p>
          <h2 className="display-lg mt-4">
            Built like an <span className="italic-accent">editorial team</span>, priced like software
          </h2>
          <p className="mt-4 font-light text-mist">Real captures from the product — not concept art.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.num} className="glass-card rv group transition-transform duration-300 hover:-translate-y-1.5">
              <span className="card-num">{f.num}</span>
              <div className="icon-gem">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-2xl font-semibold">{f.title}</h3>
              <p className="mt-2.5 text-sm font-light leading-relaxed text-mist">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how" className="relative z-[2] mx-auto max-w-6xl px-6 py-24">
        <div className="rv mx-auto mb-14 max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Four movements</p>
          <h2 className="display-lg mt-4">
            From a long video to a <span className="italic-accent gold-text">paid clip</span>
          </h2>
          <p className="mt-4 font-light text-mist">No scrubbing, no manual reframing, no spreadsheet of links.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {STEPS.map((s) => (
            <div key={s.n} className="rv flex items-start gap-6 rounded-2xl border border-hair/50 bg-onyx-2/50 p-7 backdrop-blur-sm transition-colors hover:border-hair">
              <span className="font-display text-5xl italic leading-none text-gold">{s.n}</span>
              <div>
                <h4 className="font-display text-xl font-semibold">{s.title}</h4>
                <p className="mt-1.5 text-sm font-light leading-relaxed text-mist">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= STATS ================= */}
      <section className="relative z-[2] mx-auto max-w-5xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <Stat value={8} label="hours returned / upload" />
          <Stat value={20} label="× faster throughput" />
          <Stat value={15} label="caption styles" />
          <Stat value={40} label="free credits" />
        </div>
      </section>

      {/* ================= PRICING ================= */}
      <section id="pricing" className="relative z-[2] mx-auto max-w-6xl px-6 py-24">
        <div className="rv mx-auto mb-14 max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Pricing</p>
          <h2 className="display-lg mt-4">
            One campaign payout covers <span className="italic-accent gold-text">a year</span> of it
          </h2>
          <p className="mt-4 font-light text-mist">
            1 credit ≈ 1 minute of source footage. Free starts with 40 credits, no card.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`price-ring rv ${plan.feat ? 'feat' : ''}`}>
              {plan.feat && (
                <span className="absolute right-5 top-5 rounded-full bg-gold px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-onyx">
                  Most loved
                </span>
              )}
              <p className="text-xs uppercase tracking-[0.24em] text-champagne">{plan.name}</p>
              <p className="mt-3.5 font-display text-5xl font-semibold">
                {plan.price}
                <small className="ml-1 align-middle font-body text-base font-light text-mist">{plan.period}</small>
              </p>
              <ul className="my-6 grid gap-3">
                {plan.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm font-light text-mist">
                    <span className="text-champagne">❖</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`btn-lux w-full ${plan.feat ? 'btn-gold' : 'btn-outline'}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ================= QUOTE ================= */}
      <section id="testimonials" className="relative z-[2] mx-auto max-w-4xl px-6 py-24 text-center">
        <blockquote className="rv font-display text-3xl font-medium italic leading-snug md:text-5xl">
          &ldquo;You&rsquo;re done with CapCut — done with all of it. You drop a link, your clips come out,
          and you do <span className="not-italic font-body font-medium gold-text">everything in one place.</span>&rdquo;
        </blockquote>
        <p className="rv mt-7 text-sm font-light text-mist">
          Beta tester 001 · 220K TikTok · clipping since 2020
        </p>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative z-[2] mx-auto max-w-6xl px-6 pb-8">
        <div className="rv rounded-[28px] border border-hair bg-gradient-to-br from-emerald-deep/15 to-champagne/5 px-8 py-20 text-center">
          <h2 className="display-lg">
            Paste a link. <span className="italic-accent gold-text">Start getting paid.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md font-light text-mist">
            Start free with 40 credits and no credit card. Upgrade when you outgrow the 20-minute limit.
          </p>
          <Link href="/register" className="btn-lux btn-gold mt-9 !px-9 !py-4 !text-base">
            Start free — 40 credits
          </Link>
        </div>
      </section>
    </MarketingLayout>
  )
}
