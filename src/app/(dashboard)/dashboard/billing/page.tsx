'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { initializePaddle, type Paddle } from '@paddle/paddle-js'
import { Check, Zap, ShieldCheck, Gift, Copy, CheckCircle2, Users } from 'lucide-react'

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    role: 'FREE',
    price: '$0',
    period: '/ forever',
    credits: '5 credits to start',
    items: ['Arabic & English captions', '720p exports with mark', 'Up to 3 videos / day'],
  },
  {
    key: 'basic',
    name: 'Basic',
    role: 'CLIPPER',
    price: '$15',
    period: '/ mo',
    credits: '50 credits / month',
    items: [
      '50 credits / mo (1 credit = 1 final video)',
      'No watermark · 1080p high bitrate',
      'All 18 subtitle styles & Arabic Luxury',
      'Single face tracking & 9:16 vertical crop',
    ],
  },
  {
    key: 'clipper',
    name: 'Starter',
    role: 'CLIPPER',
    price: '$29',
    period: '/ mo',
    credits: '120 credits / month',
    featured: true,
    items: [
      '120 credits / mo (1 credit = 1 final video)',
      'Opening AI Hook cards & Title overlays',
      'Priority rendering queue',
      'Campaign hub + full editor access',
    ],
  },
  {
    key: 'studio',
    name: 'Pro Creator',
    role: 'STUDIO',
    price: '$59',
    period: '/ mo',
    credits: '400 credits / month',
    items: [
      '400 credits / month',
      'VIP ultra-fast rendering queue',
      'Auto-Pilot channel watchlists',
      '2-Person Podcast Split-Screen',
      'Whop Bounty campaign ingestion',
    ],
  },
]

const CREDIT_PACKS = [
  {
    id: 'pack_50',
    name: '50 Credits',
    price: '$18',
    rate: '$0.36 / credit',
    desc: 'Perfect for quick testing and short video projects.',
    credits: 50,
  },
  {
    id: 'pack_150',
    name: '150 Credits',
    price: '$35',
    rate: '$0.23 / credit',
    desc: 'Most popular for active creators & weekly posting.',
    credits: 150,
    popular: true,
  },
  {
    id: 'pack_500',
    name: '500 Credits',
    price: '$89',
    rate: '$0.17 / credit',
    desc: 'Best value for high-volume clipping & channels.',
    credits: 500,
    bestValue: true,
  },
]

export default function BillingPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [liveCredits, setLiveCredits] = useState<number | null>(null)
  const [paddle, setPaddle] = useState<Paddle | null>(null)
  const [hasPaddleCustomer, setHasPaddleCustomer] = useState(false)
  const [referral, setReferral] = useState<{
    code: string
    referralUrl: string
    signupsCount: number
    earnedCredits: number
  } | null>(null)
  const [copiedRef, setCopiedRef] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.user) {
          if (typeof d.user.credits === 'number') {
            setLiveCredits(d.user.credits)
          }
          if (d.user.paddleCustomerId) {
            setHasPaddleCustomer(true)
          }
        }
      })
      .catch(() => {})

    fetch('/api/user/referral')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.code) {
          setReferral(d)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
    const env = (process.env.NEXT_PUBLIC_PADDLE_ENV || 'sandbox') as 'sandbox' | 'production'
    if (token) {
      initializePaddle({
        token,
        environment: env,
        eventCallback: (event) => {
          if (event.name) {
            console.log('[Paddle Event]', event.name, event.data)
          }
          if (
            event.name === 'checkout.error' ||
            event.name === 'checkout.failed' ||
            event.name === 'checkout.payment.error'
          ) {
            console.error('[Paddle Checkout Error]', event)
          }
          if (event.name === 'checkout.completed') {
            window.location.href = '/dashboard/billing?success=paddle'
          }
        },
      })
        .then((p) => {
          if (p) setPaddle(p)
        })
        .catch((err) => {
          console.warn('[Paddle] Client initialization skipped or failed:', err)
        })
    }
  }, [])

  const displayCredits = liveCredits ?? session?.user?.credits ?? 0
  const userRole = (session?.user?.role ?? 'FREE').toUpperCase()

  const searchParams = useSearchParams()
  const isSuccess = Boolean(searchParams.get('success'))
  const isSuccessPack = searchParams.get('success') === 'pack' || searchParams.get('success') === 'whop_pack'
  const addedCredits = searchParams.get('credits')

  const WHOP_CHECKOUT_URLS: Record<string, string> = {
    basic: 'https://whop.com/clipzila-com/credits-50/',
    clipper: 'https://whop.com/clipzila-com/starter-plans/',
    starter: 'https://whop.com/clipzila-com/starter-plans/',
    studio: 'https://whop.com/clipzila-com/pro-creator-plan/',
    pro: 'https://whop.com/clipzila-com/pro-creator-plan/',
    pack_50: 'https://whop.com/clipzila-com/credits-50/',
    pack_150: 'https://whop.com/clipzila-com/credits-150/',
    pack_500: 'https://whop.com/clipzila-com/credits-500/',
  }

  async function upgrade(planKey: string) {
    setError('')
    setLoading(planKey)

    // Primary: Whop Instant Checkout with user metadata
    const whopBase = WHOP_CHECKOUT_URLS[planKey]
    if (whopBase) {
      try {
        const u = new URL(whopBase)
        if (session?.user?.id) {
          u.searchParams.set('metadata[userId]', session.user.id)
        }
        if (session?.user?.email) {
          u.searchParams.set('email', session.user.email)
        }
        window.location.href = u.toString()
        return
      } catch (err) {
        console.warn('Whop URL formatting error, falling back:', err)
      }
    }

    try {
      let p = paddle
      if (!p && process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) {
        try {
          p =
            (await initializePaddle({
              token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
              environment: (process.env.NEXT_PUBLIC_PADDLE_ENV || 'production') as 'sandbox' | 'production',
            })) || null
          if (p) setPaddle(p)
        } catch (initErr) {
          console.warn('[Paddle] Re-init error:', initErr)
        }
      }

      const res = await fetch('/api/billing/paddle-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.priceId) {
        setError(data.error || 'Unable to load plan checkout. Please try again.')
        setLoading(null)
        return
      }

      if (p) {
        p.Checkout.open({
          items: [{ priceId: data.priceId, quantity: 1 }],
          customer: data.email ? { email: data.email } : undefined,
          customData: { userId: data.userId },
          settings: {
            variant: 'one-page',
            theme: 'dark',
            displayMode: 'overlay',
            successUrl: `${window.location.origin}/dashboard/billing?success=plan`,
          },
        })
        setLoading(null)
        return
      } else {
        setError('Unable to open checkout overlay. Please disable ad-blockers and try again.')
        setLoading(null)
        return
      }
    } catch (err: unknown) {
      console.error('Upgrade error:', err)
      setError('An unexpected error occurred while starting checkout. Please try again.')
      setLoading(null)
    }
  }

  async function buyPack(packId: string) {
    setError('')
    setLoading(packId)

    // Primary: Whop Instant Checkout with user metadata
    const whopBase = WHOP_CHECKOUT_URLS[packId]
    if (whopBase) {
      try {
        const u = new URL(whopBase)
        if (session?.user?.id) {
          u.searchParams.set('metadata[userId]', session.user.id)
        }
        if (session?.user?.email) {
          u.searchParams.set('email', session.user.email)
        }
        window.location.href = u.toString()
        return
      } catch (err) {
        console.warn('Whop URL formatting error, falling back:', err)
      }
    }

    try {
      const selected = CREDIT_PACKS.find((p) => p.id === packId)
      let p = paddle
      if (!p && process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) {
        try {
          p =
            (await initializePaddle({
              token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
              environment: (process.env.NEXT_PUBLIC_PADDLE_ENV || 'production') as 'sandbox' | 'production',
            })) || null
          if (p) setPaddle(p)
        } catch (initErr) {
          console.warn('[Paddle] Re-init error:', initErr)
        }
      }

      const res = await fetch('/api/billing/paddle-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.priceId) {
        setError(data.error || 'Unable to load credit pack checkout. Please try again.')
        setLoading(null)
        return
      }

      if (p) {
        p.Checkout.open({
          items: [{ priceId: data.priceId, quantity: 1 }],
          customer: data.email ? { email: data.email } : undefined,
          customData: { userId: data.userId },
          settings: {
            variant: 'one-page',
            theme: 'dark',
            displayMode: 'overlay',
            successUrl: `${window.location.origin}/dashboard/billing?success=pack&credits=${selected?.credits ?? ''}`,
          },
        })
        setLoading(null)
        return
      } else {
        setError('Unable to open checkout overlay. Please disable ad-blockers and try again.')
        setLoading(null)
        return
      }
    } catch (err: unknown) {
      console.error('Buy pack error:', err)
      setError('An unexpected error occurred while purchasing credits. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">Membership & Credits</p>
      <h1 className="display-md mt-2.5">Billing & Plans</h1>

      {isSuccess && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-300">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <p className="text-sm">
            {isSuccessPack
              ? `Payment successful! +${addedCredits ?? ''} credits have been added to your account.`
              : 'Your subscription has been activated successfully! Welcome to your new plan.'}
          </p>
        </div>
      )}

      {/* Credits balance */}
      <div className="glass-card mt-8 flex flex-wrap items-center justify-between gap-6 !p-8">
        <div>
          <p className="text-sm font-light text-mist">Credits Remaining</p>
          <p className="stat-value mt-1">{displayCredits}</p>
          <div className="mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-pearl/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold to-champagne transition-all"
              style={{ width: `${Math.min(100, (displayCredits / 800) * 100)}%` }}
            />
          </div>
        </div>
        <div className="text-right">
          <p className="max-w-xs text-sm font-light leading-relaxed text-mist">
            1 credit per full video processed into 3–6 viral clips. Credits never expire on active accounts.
          </p>
          {(userRole === 'CLIPPER' || userRole === 'STUDIO') && (
            <Link
              href={hasPaddleCustomer ? '/api/billing/paddle-portal' : '/api/billing/portal'}
              prefetch={false}
              className="btn-lux btn-outline mt-3 !py-1.5 !px-3 !text-xs inline-flex"
            >
              {hasPaddleCustomer ? 'Paddle Customer Portal' : 'Customer Billing Portal'}
            </Link>
          )}
        </div>
      </div>

      {/* Referral Program Card */}
      <div className="mt-8 rounded-3xl border border-champagne/30 bg-gradient-to-br from-champagne/10 via-onyx-2 to-black p-6 md:p-8 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-[0.2em] font-semibold text-champagne">Viral Referral Program</span>
                <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">+5 Credits / Friend</span>
              </div>
              <h3 className="font-display text-xl font-bold text-pearl mt-0.5">
                Invite Creators & Earn Free Credits
              </h3>
            </div>
          </div>
          {referral && (
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-hair/50 bg-black/40 px-4 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wider text-mist">Creators Joined</p>
                <p className="font-display text-lg font-bold text-pearl flex items-center justify-center gap-1 mt-0.5">
                  <Users className="h-3.5 w-3.5 text-champagne" />
                  {referral.signupsCount}
                </p>
              </div>
              <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wider text-gold">Credits Earned</p>
                <p className="font-display text-lg font-bold text-gold mt-0.5">
                  +{referral.earnedCredits} Credits
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 max-w-2xl text-xs sm:text-sm font-light text-mist leading-relaxed">
          Share your exclusive referral link. Any creator who signs up gets <strong>15 free credits</strong>, and you automatically earn <strong>+5 credits</strong> added instantly to your balance.
        </p>

        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-2xl">
          <input
            type="text"
            readOnly
            value={referral?.referralUrl || 'Loading referral link…'}
            className="flex-1 rounded-xl border border-hair/60 bg-black/60 px-4 py-2.5 text-xs sm:text-sm font-mono text-pearl focus:outline-none focus:border-champagne/80"
          />
          <button
            type="button"
            onClick={() => {
              if (referral?.referralUrl) {
                navigator.clipboard.writeText(referral.referralUrl)
                setCopiedRef(true)
                setTimeout(() => setCopiedRef(false), 2500)
              }
            }}
            disabled={!referral}
            className="btn-lux btn-gold !py-2.5 !px-5 inline-flex items-center justify-center gap-2 shrink-0 text-xs font-semibold"
          >
            {copiedRef ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-black" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-black" />
                Copy Referral Link
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Killer Value Proposition Banner */}
      <div className="mt-10 rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/15 via-onyx-2 to-gold/10 p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="rounded-xl bg-gold/20 p-3 text-gold shrink-0">
            <Zap className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gold/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-champagne">
                Fair Pricing Guarantee · ضمان التسعير العادل
              </span>
              <h3 className="font-display text-base font-bold text-pearl">
                1 Credit = 1 Final 1080p Video (Never pay per raw source minute)
              </h3>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-mist leading-relaxed">
              Unlike competitors who burn your credits on raw footage minutes you never use, Clipzila only charges for completed viral clips you actually export. <strong>120 Credits = 120 Ready-to-Post Videos.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Monthly Subscriptions</h2>
        <p className="mt-1 text-sm font-light text-mist">
          Choose a recurring plan for continuous content generation and best monthly value.
        </p>

        <div className="mt-6 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = userRole === plan.role || (userRole === 'ADMIN' && plan.role === 'STUDIO')
            return (
              <div key={plan.name} className={`price-ring relative ${plan.featured ? 'feat' : ''}`}>
                {isCurrent && (
                  <span className="absolute right-5 top-5 rounded-full border border-champagne/40 bg-champagne/10 px-3 py-1 text-[10px] uppercase tracking-widest text-champagne">
                    Current plan
                  </span>
                )}
                {plan.featured && !isCurrent && (
                  <span className="absolute right-5 top-5 rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold">
                    Most Popular
                  </span>
                )}
                <p className="text-xs uppercase tracking-[0.24em] text-champagne">{plan.name}</p>
                <p className="mt-3.5 font-display text-4xl font-semibold">
                  {plan.price}
                  <small className="ml-1 align-middle font-body text-sm font-light text-mist">{plan.period}</small>
                </p>
                <p className="mt-2 text-sm font-medium text-gold">{plan.credits}</p>
                <ul className="my-6 grid gap-2.5">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm font-light text-mist">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-champagne" />
                      {item}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  plan.role === 'FREE' ? (
                    <button disabled className="btn-lux btn-outline w-full opacity-50">Current plan</button>
                  ) : (
                    <Link
                      href={hasPaddleCustomer ? '/api/billing/paddle-portal' : '/api/billing/portal'}
                      prefetch={false}
                      className="btn-lux btn-outline w-full text-center block"
                    >
                      Manage subscription
                    </Link>
                  )
                ) : (
                  <div className="space-y-2.5">
                    <button
                      onClick={() => upgrade(plan.key)}
                      disabled={loading !== null}
                      className={`btn-lux w-full ${plan.featured ? 'btn-gold' : 'btn-outline'} disabled:opacity-60`}
                    >
                      {loading === plan.key ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                    </button>
                    <p className="text-center text-[11px] leading-tight text-mist-2">
                      Secure checkout · Instant activation · Cancel anytime
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Pay As You Go Credit Packs */}
      <div className="mt-16 rounded-3xl border border-hair/50 bg-onyx-2 p-8 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-gold">
              <Zap className="h-4 w-4" />
              <span>One-Time Top Up</span>
            </div>
            <h2 className="font-display text-2xl font-semibold mt-1">Pay-As-You-Go Credit Packs</h2>
            <p className="mt-1 text-sm font-light text-mist">
              Prefer not to subscribe? Top up credits anytime — they never expire on active accounts.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`relative rounded-2xl border p-6 transition-all ${
                pack.popular
                  ? 'border-gold bg-gold/5 shadow-lg shadow-gold/5'
                  : 'border-hair/50 bg-black/30 hover:border-hair'
              }`}
            >
              {pack.popular && (
                <span className="absolute -top-3 right-5 rounded-full border border-gold bg-gold px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                  POPULAR
                </span>
              )}
              {pack.bestValue && (
                <span className="absolute -top-3 right-5 rounded-full border border-sky-400 bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                  BEST VALUE
                </span>
              )}

              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-xl font-bold text-pearl">{pack.name}</h3>
                <span className="font-display text-2xl font-bold text-gold">{pack.price}</span>
              </div>
              <p className="mt-1 text-xs font-mono text-champagne">{pack.rate}</p>
              <p className="mt-3 text-xs leading-relaxed text-mist">{pack.desc}</p>

              <button
                onClick={() => buyPack(pack.id)}
                disabled={loading !== null}
                className={`btn-lux mt-6 w-full text-xs font-semibold ${
                  pack.popular ? 'btn-gold' : 'btn-outline'
                } disabled:opacity-50`}
              >
                {loading === pack.id ? 'Redirecting…' : `Buy ${pack.credits} Credits`}
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-10 text-center text-sm font-light text-mist">
        Need invoice history or a custom tier?{' '}
        <a href="mailto:support@clipzila.com" className="text-gold underline underline-offset-4">
          Contact support
        </a>
      </p>
    </div>
  )
}
