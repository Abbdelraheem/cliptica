'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Play,
  Flame,
  TrendingUp,
  Users,
  DollarSign,
  Zap,
  Target,
  BarChart3,
  Share2,
  Eye,
  Heart,
  Trophy,
  Crown,
  ArrowRight,
  ArrowUpRight,
  Youtube,
  Instagram,
  Twitter,
  MessageCircle,
  Wallet,
  Layers,
  BadgeCheck,
  Timer,
  Sparkles,
  Video,
  Megaphone,
  Rocket,
  Activity,
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

function Avatar({ name, hue = 20 }: { name: string; hue?: number }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-xs font-bold text-white"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 90% 55%), hsl(${hue + 30} 85% 38%))`,
      }}
      aria-hidden="true"
    >
      {name.replace('@', '').slice(0, 2).toUpperCase()}
    </span>
  )
}

function AreaChart({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 600 220" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff5a1f" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff5a1f" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff7a3d" />
          <stop offset="100%" stopColor="#ffb27a" />
        </linearGradient>
      </defs>
      {[40, 90, 140, 190].map((y) => (
        <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}
      <path
        d="M0,180 C50,175 80,150 120,148 C165,145 190,120 240,118 C290,116 310,88 360,84 C410,80 430,60 480,52 C520,46 560,30 600,24 L600,220 L0,220 Z"
        fill={`url(#${id}-fill)`}
        className="chart-fade"
      />
      <path
        d="M0,180 C50,175 80,150 120,148 C165,145 190,120 240,118 C290,116 310,88 360,84 C410,80 430,60 480,52 C520,46 560,30 600,24"
        fill="none"
        stroke={`url(#${id}-line)`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="900"
        strokeDashoffset="900"
        className="chart-draw"
      />
      <circle cx="600" cy="24" r="5" fill="#ff5a1f" className="chart-dot">
        <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

/* ---------------- hero ---------------- */

const HERO_STATS = [
  { label: 'Total Views', value: 2481920, icon: Eye },
  { label: 'Total Clips', value: 184, icon: Video },
  { label: 'Total Earnings', value: 8420, money: true, icon: DollarSign },
  { label: 'Engagement Rate', value: 8.7, suffix: '%', dec: 1, icon: Activity },
]

function LiveViews() {
  const [v, setV] = useState(2481920)
  useEffect(() => {
    const t = setInterval(() => setV((x) => x + Math.floor(Math.random() * 47) + 6), 2400)
    return () => clearInterval(t)
  }, [])
  return <span>{v.toLocaleString('en-US')}</span>
}

function HeroDashboard() {
  return (
    <div className="dash glass-card relative mx-auto mt-16 max-w-4xl !rounded-3xl !p-6 md:!p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-mist-2">
            Campaign Overview
          </p>
          <h3 className="font-display text-xl font-bold">Build In Public</h3>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-hair bg-surface px-3 py-1.5 text-xs text-mist">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Live
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {HERO_STATS.map((s) => (
          <div key={s.label} className="rounded-2xl border border-hair bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-mist-2">{s.label}</p>
              <s.icon className="h-3.5 w-3.5 text-champagne" />
            </div>
            <p className="mt-2 font-display text-xl font-extrabold tracking-tight text-white md:text-2xl">
              {s.label === 'Total Views' ? (
                <LiveViews />
              ) : s.money ? (
                <CountUp end={s.value} prefix="$" />
              ) : (
                <CountUp end={s.value} decimals={s.dec ?? 0} suffix={s.suffix ?? ''} />
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="relative mt-5 h-44 overflow-hidden rounded-2xl border border-hair bg-white/[0.02] p-3 md:h-52">
        <AreaChart id="hero-chart" />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-hair/60 pt-5">
        <div className="flex items-center -space-x-2">
          {['@alex', '@maya', '@ryan', '@sam', '@kai'].map((n, i) => (
            <Avatar key={n} name={n} hue={18 + i * 26} />
          ))}
          <span className="ml-4 text-xs text-mist">+179 creators active</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-mist-2">
          <Play className="h-3.5 w-3.5 text-champagne" /> TikTok
          <Instagram className="h-3.5 w-3.5 text-champagne" /> Reels
          <Youtube className="h-3.5 w-3.5 text-champagne" /> Shorts
        </div>
      </div>
    </div>
  )
}

function FloatCard({
  className,
  rotate,
  delay,
  children,
}: {
  className: string
  rotate: string
  delay: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`float-card absolute z-10 hidden w-56 rounded-2xl border border-hair bg-[#111111]/85 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:block ${className}`}
      style={{ transform: `rotate(${rotate})`, animationDelay: delay }}
      aria-hidden="true"
    >
      {children}
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-36 md:pt-44">
      <div className="hero-glow pointer-events-none absolute left-1/2 top-[-200px] h-[720px] w-[1100px] -translate-x-1/2" aria-hidden="true" />

      <FloatCard className="left-[4%] top-[240px]" rotate="-4deg" delay="0s">
        <p className="flex items-center gap-2 text-xs font-semibold text-champagne">
          <Flame className="h-3.5 w-3.5" /> Trending Campaign
        </p>
        <p className="mt-2 font-display text-lg font-extrabold">$2,500 Reward Pool</p>
        <div className="mt-2 flex items-center justify-between text-xs text-mist">
          <span>18.4K Views</span>
          <span className="flex items-center gap-1 font-semibold text-orange-400">
            <ArrowUpRight className="h-3.5 w-3.5" /> 24%
          </span>
        </div>
      </FloatCard>

      <FloatCard className="right-[4%] top-[210px]" rotate="3.5deg" delay="-3s">
        <p className="flex items-center gap-2 text-xs font-semibold text-champagne">
          <Crown className="h-3.5 w-3.5" /> Top Creator
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <Avatar name="@cr" hue={24} />
          <span className="text-sm font-semibold">@creatorname</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-mist">
          <span>1.82M Views</span>
          <span className="font-semibold text-orange-400">$4,820 Earned</span>
        </div>
      </FloatCard>

      <FloatCard className="bottom-[120px] right-[9%]" rotate="-3deg" delay="-6s">
        <p className="text-xs font-semibold text-champagne">Campaign Performance</p>
        <div className="mt-2 space-y-1.5 text-xs text-mist">
          <p>Views: <b className="text-white">2.4M</b></p>
          <p>Clips: <b className="text-white">184</b></p>
          <p>Engagement: <b className="text-white">8.7%</b></p>
        </div>
      </FloatCard>

      <div className="relative mx-auto max-w-4xl text-center">
        <p className="eyebrow rv in">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
          10,000+ creators already building
        </p>
        <h1 className="display-xl mt-6 rv in" style={{ transitionDelay: '80ms' }}>
          Turn Content Into Reach.
          <br />
          Turn Reach Into <span className="gold-text">Revenue.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-mist md:text-lg rv in" style={{ transitionDelay: '160ms' }}>
          Clip. Publish. Track. Earn. The all-in-one platform for creators, editors and brands
          building the next generation of short-form content.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3 rv in" style={{ transitionDelay: '240ms' }}>
          <Link href="/register" className="btn-lux btn-primary !rounded-xl !px-7">
            Start Clipping <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <a href="#marketplace" className="btn-lux btn-outline !rounded-xl !px-7">
            Explore Campaigns
          </a>
        </div>
      </div>

      <div className="rv in">
        <HeroDashboard />
      </div>
    </section>
  )
}

/* ---------------- social proof ---------------- */

function SocialProof() {
  const logos = ['CreatorHub', 'StreamLab', 'Pulse', 'Nova', 'Vertex', 'MediaX']
  return (
    <section className="border-y border-hair/60 bg-white/[0.015] px-6 py-12">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.32em] text-mist-2">
        Powering the next generation of content
      </p>
      <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-x-14 gap-y-5">
        {logos.map((l) => (
          <span key={l} className="font-display text-lg font-bold tracking-wide text-white/25 transition-colors duration-300 hover:text-white/45">
            {l}
          </span>
        ))}
      </div>
    </section>
  )
}

/* ---------------- how it works ---------------- */

function HowItWorks() {
  const steps = [
    { n: '01', icon: Target, title: 'Choose a Campaign', desc: 'Browse campaigns from creators and brands.' },
    { n: '02', icon: Video, title: 'Create The Clip', desc: 'Turn long-form content into high-performing short-form videos.' },
    { n: '03', icon: Wallet, title: 'Publish & Earn', desc: 'Publish your clips, track performance and earn based on results.' },
  ]
  return (
    <section id="how" className="px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="display-lg text-center rv">From Content To Cash In Three Steps</h2>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="glass-card rv group">
              <span className="card-num">{s.n}</span>
              <span className="icon-gem">
                <s.icon className="h-5 w-5" />
              </span>
              <h3 className="font-display text-xl font-bold">{s.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-mist">{s.desc}</p>
              <div className="mt-5 h-px w-full bg-gradient-to-r from-orange-500/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- main feature ---------------- */

function MainFeature() {
  return (
    <section id="features" className="px-6 pb-28">
      <div className="mx-auto max-w-6xl">
        <div className="glass-card grid items-center gap-10 overflow-hidden !p-8 md:grid-cols-2 md:!p-12 rv">
          <div>
            <p className="eyebrow !border-champagne/30 !text-champagne">
              <BarChart3 className="h-3.5 w-3.5" /> Analytics
            </p>
            <h2 className="display-md mt-5">Real-Time Campaign Analytics</h2>
            <p className="mt-4 leading-relaxed text-mist">
              Track every view, click, engagement and conversion from one powerful dashboard.
            </p>
            <Link href="/dashboard" className="btn-lux btn-outline mt-7 !rounded-xl">
              Explore Analytics <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-2xl border border-hair bg-[#0d0d0d]/80 p-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Views', '2.4M'],
                ['Engagement', '8.7%'],
                ['CTR', '6.4%'],
                ['Revenue', '$4,820'],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-hair bg-white/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-mist-2">{l}</p>
                  <p className="mt-1 font-display text-lg font-extrabold">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 h-40 overflow-hidden rounded-xl border border-hair bg-black/30 p-2">
              <AreaChart id="feat-chart" />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="glass-card rv">
            <span className="icon-gem"><Trophy className="h-5 w-5" /></span>
            <h3 className="font-display text-xl font-bold">Creator Leaderboards</h3>
            <div className="mt-5 space-y-2.5">
              {[
                ['#1', '@Alex', '2.4M Views', '$8,420', 20],
                ['#2', '@Ryan', '1.9M Views', '$6,240', 250],
                ['#3', '@Maya', '1.4M Views', '$4,920', 320],
              ].map(([rank, name, views, earn, hue]) => (
                <div key={rank as string} className="flex items-center gap-3 rounded-xl border border-hair bg-white/[0.03] px-3.5 py-2.5">
                  <span className="w-6 text-sm font-bold text-champagne">{rank}</span>
                  <Avatar name={name as string} hue={hue as number} />
                  <span className="text-sm font-semibold">{name}</span>
                  <span className="ml-auto text-xs text-mist">{views}</span>
                  <span className="text-xs font-semibold text-orange-400">{earn}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rv">
            <span className="icon-gem"><Sparkles className="h-5 w-5" /></span>
            <h3 className="font-display text-xl font-bold">Smart Campaign Matching</h3>
            <div className="mt-6 flex items-center justify-between gap-1">
              {['Creator', 'Campaign', 'Audience', 'Revenue'].map((n, i) => (
                <div key={n} className="flex flex-1 items-center last:flex-none">
                  <div className={`node ${i === 3 ? 'node-hot' : ''}`}>
                    <span className="text-[10px] font-bold sm:text-[11px]">{n.split(' ')[0]}</span>
                  </div>
                  {i < 3 && <span className="link-line mx-auto block h-px flex-1" />}
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-mist">
              Our engine pairs your content style with the campaigns most likely to perform.
            </p>
          </div>

          <div className="glass-card rv">
            <span className="icon-gem"><DollarSign className="h-5 w-5" /></span>
            <h3 className="font-display text-xl font-bold">Performance-Based Rewards</h3>
            <div className="mt-5 space-y-2.5">
              {[
                ['1,000 Views', '$5'],
                ['10,000 Views', '$50'],
                ['100,000 Views', '$500'],
                ['1,000,000 Views', '$5,000'],
              ].map(([v, r]) => (
                <div key={v} className="flex items-center justify-between rounded-xl border border-hair bg-white/[0.03] px-4 py-2.5 text-sm">
                  <span className="text-mist">{v}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-mist-2" />
                  <span className="font-display font-extrabold text-orange-400">{r}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rv">
            <span className="icon-gem"><Share2 className="h-5 w-5" /></span>
            <h3 className="font-display text-xl font-bold">Multi-Platform Publishing</h3>
            <div className="mt-5 space-y-3">
              {[
                [<Play key="t" className="h-4 w-4" />, 'TikTok', 92],
                [<Instagram key="i" className="h-4 w-4" />, 'Instagram', 78],
                [<Youtube key="y" className="h-4 w-4" />, 'YouTube', 84],
                [<Twitter key="x" className="h-4 w-4" />, 'X', 61],
              ].map(([icon, label, pct], i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-hair bg-white/[0.04] text-champagne">
                    {icon as React.ReactNode}
                  </span>
                  <span className="w-20 text-sm text-mist">{label as string}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="bar-fill h-full rounded-full bg-gradient-to-r from-orange-600 to-orange-400"
                      style={{ '--w': `${pct}%` } as React.CSSProperties}
                    />
                  </div>
                  <span className="w-9 text-right text-xs font-semibold text-orange-400">{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------- marketplace ---------------- */

type Campaign = {
  name: string
  creator: string
  pool: string
  cpm: string
  views: string
  creators: number
  deadline: string
  cats: string[]
  grad: string
  tag: string
}

const CAMPAIGNS: Campaign[] = [
  { name: 'Build In Public', creator: '@sarahfounder', pool: '$5,000', cpm: '$2.50', views: '1.8M', creators: 42, deadline: '12 days', cats: ['Business', 'Trending'], grad: 'from-orange-700/70 via-[#1a0e08] to-[#0c0c0c]', tag: 'B' },
  { name: 'AI Business Revolution', creator: '@neonlabs', pool: '$3,200', cpm: '$3.10', views: '2.1M', creators: 67, deadline: '8 days', cats: ['AI', 'Trending', 'Highest Reward'], grad: 'from-amber-700/60 via-[#161009] to-[#0c0c0c]', tag: 'AI' },
  { name: 'Greatest Gaming Plays', creator: '@clutchking', pool: '$2,800', cpm: '$1.90', views: '3.4M', creators: 91, deadline: '21 days', cats: ['Gaming'], grad: 'from-red-800/50 via-[#140a08] to-[#0c0c0c]', tag: 'G' },
  { name: 'Market Movers Daily', creator: '@finfluencer', pool: '$4,100', cpm: '$3.80', views: '980K', creators: 38, deadline: '15 days', cats: ['Finance', 'Highest Reward'], grad: 'from-yellow-700/40 via-[#151009] to-[#0c0c0c]', tag: '$' },
  { name: 'Deep Dive Podcasts', creator: '@thevault', pool: '$1,900', cpm: '$2.10', views: '640K', creators: 25, deadline: '30 days', cats: ['Podcasts', 'New'], grad: 'from-orange-800/50 via-[#100c0a] to-[#0c0c0c]', tag: 'P' },
  { name: 'Slow Living Series', creator: '@quietmind', pool: '$1,400', cpm: '$1.70', views: '410K', creators: 19, deadline: '18 days', cats: ['Lifestyle', 'New'], grad: 'from-stone-600/30 via-[#121110] to-[#0c0c0c]', tag: 'S' },
]

const FILTERS = ['All', 'Trending', 'Highest Reward', 'New', 'Gaming', 'Finance', 'Podcasts', 'Lifestyle', 'AI', 'Business']

function Marketplace() {
  const [filter, setFilter] = useState('All')
  const list =
    filter === 'All' ? CAMPAIGNS : CAMPAIGNS.filter((c) => c.cats.includes(filter))

  return (
    <section id="marketplace" className="border-t border-hair/60 bg-white/[0.012] px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="display-lg rv">Find Your Next Campaign</h2>
          <p className="mx-auto mt-4 max-w-xl text-mist rv">
            Choose campaigns that match your audience, content style and earning goals.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-2 rv">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`pill ${filter === f ? 'pill-on' : ''}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <article key={c.name} className="glass-card group !p-0 rv">
              <div className={`relative flex h-36 items-center justify-center overflow-hidden rounded-t-[17px] bg-gradient-to-br ${c.grad}`}>
                <span className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.35)_1px,transparent_0)] [background-size:14px_14px]" />
                <span className="z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-black/35 font-display text-xl font-extrabold text-white backdrop-blur-sm transition-transform duration-500 group-hover:scale-110">
                  {c.tag}
                </span>
                {c.cats.includes('Trending') && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-orange-400 backdrop-blur-sm">
                    <Flame className="h-3 w-3" /> Trending
                  </span>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <Avatar name={c.creator} hue={22} />
                  <span className="text-xs text-mist">{c.creator}</span>
                </div>
                <h3 className="mt-3 font-display text-lg font-bold leading-snug">{c.name}</h3>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-extrabold text-orange-400">{c.pool}</span>
                  <span className="text-xs text-mist-2">reward pool</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ['CPM', c.cpm],
                    ['Views', c.views],
                    ['Creators', String(c.creators)],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-lg border border-hair bg-white/[0.03] py-2">
                      <p className="text-[10px] uppercase tracking-wide text-mist-2">{l}</p>
                      <p className="text-sm font-bold">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-mist-2">
                    <Timer className="h-3.5 w-3.5" /> {c.deadline} left
                  </span>
                  <button className="btn-lux btn-primary !rounded-lg !px-4 !py-2 !text-xs">
                    Join Campaign <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- trending strip ---------------- */

function TrendingStrip() {
  const items = [
    { name: 'AI Business Revolution', pct: '+184%', pool: '$3,200' },
    { name: 'Greatest Gaming Plays', pct: '+142%', pool: '$2,800' },
    { name: 'Build In Public', pct: '+96%', pool: '$5,000' },
    { name: 'Market Movers Daily', pct: '+73%', pool: '$4,100' },
  ]
  return (
    <section className="px-6 pb-28 pt-2">
      <div className="mx-auto max-w-6xl space-y-3">
        {items.map((t, i) => (
          <div
            key={t.name}
            className="glass-card group flex flex-wrap items-center gap-4 !p-4 md:!p-5 rv"
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            <span className="flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-400">
              <Flame className="h-3.5 w-3.5 animate-pulse" /> Trending
            </span>
            <h3 className="font-display text-base font-bold md:text-lg">{t.name}</h3>
            <span className="flex items-center gap-1 text-sm font-bold text-orange-400">
              <TrendingUp className="h-4 w-4" /> {t.pct} this week
            </span>
            <span className="ml-auto text-sm text-mist">{t.pool} reward pool</span>
            <ArrowUpRight className="h-4 w-4 text-mist-2 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:text-orange-400" />
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------------- creator section ---------------- */

function CreatorSection() {
  return (
    <section id="creators" className="px-6 pb-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div className="rv">
          <p className="eyebrow"><Users className="h-3.5 w-3.5" /> For Editors & Creators</p>
          <h2 className="display-md mt-5">Your Editing Skills Can Pay You</h2>
          <p className="mt-4 leading-relaxed text-mist">
            Stop editing for exposure. Create clips that perform and get rewarded for the results.
          </p>
          <Link href="/register" className="btn-lux btn-primary mt-8 !rounded-xl">
            Become a Clip Creator <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="glass-card !p-6 rv md:!p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-mist-2">Creator Dashboard</p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Total Earnings', '$7,842.40'],
              ['Views', '4.82M'],
              ['Clips', '126'],
              ['Avg CPM', '$2.84'],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-hair bg-white/[0.03] p-3.5">
                <p className="text-[10px] uppercase tracking-wide text-mist-2">{l}</p>
                <p className="mt-1 font-display text-base font-extrabold md:text-lg">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 h-40 overflow-hidden rounded-xl border border-hair bg-black/30 p-2">
            <AreaChart id="creator-chart" />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-orange-500/25 bg-gradient-to-r from-orange-500/10 to-transparent px-4 py-3">
            <span className="text-sm text-mist">Next payout</span>
            <span className="font-display text-lg font-extrabold text-orange-400">$1,240.00</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------- creator profile ---------------- */

function CreatorProfile() {
  const clips = [
    { v: '482K', l: '31K', s: '4.2K', e: '$182', g: 'from-orange-600/60 via-[#171009] to-black' },
    { v: '356K', l: '24K', s: '3.1K', e: '$146', g: 'from-amber-600/50 via-[#141009] to-black' },
    { v: '298K', l: '19K', s: '2.6K', e: '$121', g: 'from-red-700/40 via-[#130c09] to-black' },
    { v: '245K', l: '15K', s: '2.0K', e: '$98', g: 'from-orange-800/50 via-[#120d0b] to-black' },
    { v: '198K', l: '11K', s: '1.4K', e: '$79', g: 'from-yellow-700/35 via-[#131009] to-black' },
  ]
  return (
    <section className="border-y border-hair/60 bg-white/[0.012] px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="glass-card flex flex-wrap items-center gap-6 !p-7 rv">
          <span className="relative">
            <Avatar name="@alexcreates" hue={22} />
            <BadgeCheck className="absolute -bottom-1 -right-1 h-4.5 w-4.5 rounded-full bg-[#111] text-orange-400" size={18} />
          </span>
          <div>
            <h3 className="font-display text-xl font-extrabold">@alexcreates</h3>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-champagne">Verified Creator · ELITE</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-6">
            {[
              ['Total Views', '1.8M'],
              ['Earned', '$12,480'],
              ['Clips', '184'],
              ['Campaigns', '98'],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="text-[10px] uppercase tracking-wide text-mist-2">{l}</p>
                <p className="font-display text-lg font-extrabold">{v}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {clips.map((c, i) => (
            <div key={i} className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-hair rv" style={{ transitionDelay: `${i * 60}ms` }}>
              <div className={`absolute inset-0 bg-gradient-to-br ${c.g}`} />
              <span className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.4)_1px,transparent_0)] [background-size:12px_12px]" />
              <span className="absolute left-1/2 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 backdrop-blur-sm transition-transform duration-500 group-hover:scale-110">
                <Play className="h-4 w-4 fill-white text-white" />
              </span>
              <div className="absolute inset-x-0 bottom-0 z-10 space-y-1 bg-gradient-to-t from-black/85 to-transparent p-3 text-[11px]">
                <p className="flex items-center gap-1.5 font-bold text-white"><Eye className="h-3 w-3 text-orange-400" /> {c.v}</p>
                <p className="flex items-center gap-1.5 text-mist"><Heart className="h-3 w-3" /> {c.l} <Share2 className="ml-1 h-3 w-3" /> {c.s}</p>
                <p className="flex items-center gap-1.5 font-bold text-orange-400"><DollarSign className="h-3 w-3" /> {c.e}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- leaderboard ---------------- */

function Leaderboard() {
  const podium = [
    { rank: 2, name: '@CreatorTwo', views: '3.91M', earned: '$9,820', h: 'h-40', hue: 260 },
    { rank: 1, name: '@CreatorOne', views: '4.82M', earned: '$12,420', h: 'h-52', hue: 24 },
    { rank: 3, name: '@CreatorThree', views: '3.12M', earned: '$8,410', h: 'h-32', hue: 330 },
  ]
  return (
    <section id="leaderboard" className="px-6 py-28">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="display-lg rv">Who&apos;s Winning This Week?</h2>
        <div className="mt-16 flex items-end justify-center gap-4 md:gap-8">
          {podium.map((p) => (
            <div key={p.rank} className={`flex w-36 flex-col items-center md:w-48 ${p.rank === 1 ? '-mt-8' : ''}`}>
              <span className={`mb-3 ${p.rank === 1 ? 'text-orange-400' : 'text-mist-2'}`}>
                {p.rank === 1 ? <Crown className="h-7 w-7 drop-shadow-[0_0_12px_rgba(255,90,31,0.7)]" /> : <Trophy className="h-5 w-5" />}
              </span>
              <span className="relative">
                <span className={`block ${p.rank === 1 ? 'h-16 w-16 text-lg' : 'h-12 w-12'} rounded-full`}>
                  <Avatar name={p.name} hue={p.hue} />
                </span>
              </span>
              <p className="mt-3 text-sm font-bold">{p.name}</p>
              <p className="text-xs text-mist">{p.views} Views</p>
              <p className="font-display text-sm font-extrabold text-orange-400">{p.earned}</p>
              <div className={`mt-4 flex w-full items-start justify-center rounded-t-2xl border border-b-0 border-hair bg-gradient-to-b from-white/[0.06] to-transparent ${p.h}`}>
                <span className={`font-display ${p.rank === 1 ? 'text-4xl' : 'text-3xl'} font-extrabold ${p.rank === 1 ? 'gold-text' : 'text-mist-2'}`}>
                  {p.rank}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- economy flow ---------------- */

function EconomyFlow() {
  const steps = ['CREATOR', 'CAMPAIGN', 'CLIPPER', 'SOCIAL PLATFORM', 'VIEWS', 'REVENUE']
  return (
    <section className="border-y border-hair/60 bg-white/[0.012] px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <p className="eyebrow mx-auto flex w-fit rv"><Zap className="h-3.5 w-3.5" /> The ClipForge Economy</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-y-6">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center">
              <span className={`flow-node ${i === steps.length - 1 ? 'flow-node-final' : ''}`}>{s}</span>
              {i < steps.length - 1 && (
                <span className="flow-arrow mx-2 md:mx-3" aria-hidden="true">
                  <ArrowRight className="h-4 w-4 text-orange-500/70" />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- why clipforge ---------------- */

function WhyClipForge() {
  const cards = [
    { icon: TrendingUp, title: 'More Reach', desc: 'Turn one long video into hundreds of distribution opportunities.' },
    { icon: DollarSign, title: 'More Revenue', desc: 'Reward creators and clippers based on real performance.' },
    { icon: Target, title: 'More Control', desc: 'Track every campaign from one dashboard.' },
    { icon: Rocket, title: 'More Growth', desc: 'Use analytics to understand what content actually performs.' },
  ]
  return (
    <section className="px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="display-lg text-center rv">Why ClipForge</h2>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.title} className="glass-card rv !p-6">
              <span className="icon-gem !mb-4"><c.icon className="h-5 w-5" /></span>
              <h3 className="font-display text-lg font-bold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- final cta ---------------- */

function FinalCta() {
  const particles = [
    { l: '12%', t: '30%', d: '0s', s: 5 }, { l: '20%', t: '65%', d: '-2s', s: 4 },
    { l: '33%', t: '20%', d: '-4s', s: 3 }, { l: '68%', t: '25%', d: '-1s', s: 5 },
    { l: '80%', t: '60%', d: '-3s', s: 4 }, { l: '88%', t: '35%', d: '-5s', s: 3 },
    { l: '50%', t: '75%', d: '-2.5s', s: 4 }, { l: '42%', t: '15%', d: '-6s', s: 3 },
  ]
  return (
    <section className="relative overflow-hidden px-6 py-32">
      <div className="hero-glow pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[900px] -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />
      {particles.map((p, i) => (
        <span
          key={i}
          className="particle"
          style={{ left: p.l, top: p.t, width: p.s, height: p.s, animationDelay: p.d }}
          aria-hidden="true"
        />
      ))}
      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className="display-lg rv">Your Next Viral Clip Starts Here.</h2>
        <p className="mt-5 text-lg text-mist rv">Join thousands of creators turning attention into income.</p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3 rv">
          <Link href="/register" className="btn-lux btn-primary !rounded-xl !px-8">
            Start Creating <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/register" className="btn-lux btn-outline !rounded-xl !px-8">
            Launch A Campaign
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ---------------- page ---------------- */

export default function HomePage() {
  return (
    <MarketingLayout>
      <style>{`
        .hero-glow{
          background:radial-gradient(closest-side,rgba(255,90,31,.22),rgba(232,67,10,.08) 45%,transparent 72%);
          filter:blur(30px);animation:glow-pulse 7s ease-in-out infinite;
        }
        @keyframes glow-pulse{0%,100%{opacity:.85}50%{opacity:1}}
        .float-card{animation:floaty 7s ease-in-out infinite}
        @keyframes floaty{0%,100%{transform:translateY(0) rotate(var(--r,0deg))}50%{transform:translateY(-12px) rotate(var(--r,0deg))}}
        .chart-draw{transition:stroke-dashoffset 2.2s cubic-bezier(.2,.7,.2,1) .3s}
        .chart-fade{opacity:0;transition:opacity 1.4s ease 1.2s}
        .in .chart-draw,.rv.in .chart-draw{stroke-dashoffset:0}
        .in .chart-fade,.rv.in .chart-fade{opacity:1}
        .bar-fill{width:var(--w);transition:width 1.6s cubic-bezier(.2,.7,.2,1) .4s}
        .rv:not(.in) .bar-fill{width:0}
        .pill{border-radius:999px;border:1px solid var(--hair);background:rgba(255,255,255,.03);
          padding:8px 16px;font-size:.83rem;color:var(--mist);cursor:pointer;transition:all .25s var(--ease-lux)}
        .pill:hover{color:#fff;border-color:rgba(255,122,61,.4)}
        .pill-on{background:linear-gradient(120deg,var(--gold),var(--gold-2));color:#fff;border-color:transparent;
          box-shadow:0 0 18px rgba(255,90,31,.3)}
        .node{display:flex;align-items:center;justify-content:center;border-radius:12px;
          border:1px solid rgba(255,122,61,.35);background:rgba(255,90,31,.08);
          min-width:64px;padding:10px 6px;text-align:center;color:#ffd9c4}
        .node-hot{box-shadow:0 0 22px rgba(255,90,31,.35);border-color:rgba(255,122,61,.7)}
        .link-line{position:relative;background:linear-gradient(90deg,rgba(255,90,31,.5),rgba(255,90,31,.15));
          min-width:12px;height:1px}
        .link-line::after{content:"";position:absolute;top:-2px;left:0;width:5px;height:5px;border-radius:999px;
          background:#ff7a3d;box-shadow:0 0 10px rgba(255,122,61,.9);animation:travel 2.6s linear infinite}
        @keyframes travel{to{transform:translateX(calc(100% + 60px))}}
        .flow-node{display:inline-flex;align-items:center;border-radius:999px;border:1px solid var(--hair);
          background:rgba(255,255,255,.03);padding:10px 18px;font-size:.78rem;font-weight:700;
          letter-spacing:.14em;color:var(--mist)}
        .flow-node-final{border-color:rgba(255,122,61,.55);background:linear-gradient(120deg,rgba(255,90,31,.18),rgba(255,90,31,.06));
          color:#ffb27a;box-shadow:0 0 26px rgba(255,90,31,.22)}
        .flow-arrow{animation:pulse-arrow 1.6s ease-in-out infinite}
        @keyframes pulse-arrow{0%,100%{opacity:.45}50%{opacity:1}}
        .particle{position:absolute;border-radius:999px;background:#ff7a3d;
          box-shadow:0 0 12px rgba(255,122,61,.9);opacity:.55;animation:rise 6s ease-in-out infinite}
        @keyframes rise{0%,100%{transform:translateY(0);opacity:.35}50%{transform:translateY(-34px);opacity:.75}}
        .float-card{--r:0deg}
      `}</style>
      <Hero />
      <SocialProof />
      <HowItWorks />
      <MainFeature />
      <Marketplace />
      <TrendingStrip />
      <CreatorSection />
      <CreatorProfile />
      <Leaderboard />
      <EconomyFlow />
      <WhyClipForge />
      <FinalCta />
    </MarketingLayout>
  )
}
