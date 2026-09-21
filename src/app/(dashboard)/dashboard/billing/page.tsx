'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { initializePaddle, type Paddle } from '@paddle/paddle-js'
import {
  Check,
  Zap,
  ShieldCheck,
  Gift,
  Copy,
  CheckCircle2,
  Users,
  X,
  Lock,
  ExternalLink,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Wordmark, ClipticaMark } from '@/components/logo'

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

interface ActiveCheckoutState {
  itemType: 'plan' | 'pack'
  itemId: string
  itemName: string
  price: string
  credits: string
  features: string[]
  priceId: string
  sessionId?: string | null
}

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

  // Embedded Inline Checkout State
  const [activeCheckout, setActiveCheckout] = useState<ActiveCheckoutState | null>(null)
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)

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

  const handlePaddleEvent = useCallback((event: any) => {
    if (!event?.name) return
    console.log('[Paddle Event]', event.name, event.data)

    if (event.name === 'checkout.loaded') {
      setIsCheckoutLoading(false)
    }

    if (event.name === 'checkout.completed') {
      if (activeCheckout?.sessionId) {
        fetch('/api/billing/track-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'completed',
            checkoutSessionId: activeCheckout.sessionId,
            paddleTxId: event.data?.transaction_id || event.data?.id,
          }),
        }).catch(() => {})
      }
      window.location.href = '/dashboard/billing?success=paddle'
    }

    if (
      event.name === 'checkout.error' ||
      event.name === 'checkout.failed' ||
      event.name === 'checkout.payment.error'
    ) {
      console.error('[Paddle Checkout Error]', event)
      setIsCheckoutLoading(false)
    }
  }, [activeCheckout?.sessionId])

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
    const env = (process.env.NEXT_PUBLIC_PADDLE_ENV || 'sandbox') as 'sandbox' | 'production'
    if (token && !paddle) {
      initializePaddle({
        token,
        environment: env,
        eventCallback: handlePaddleEvent,
      })
        .then((p) => {
          if (p) setPaddle(p)
        })
        .catch((err) => {
          console.warn('[Paddle] Client initialization skipped or failed:', err)
        })
    }
  }, [handlePaddleEvent, paddle])

  // Open inline checkout frame whenever activeCheckout is set
  useEffect(() => {
    if (!activeCheckout || !paddle) return

    setIsCheckoutLoading(true)

    const timer = setTimeout(() => {
      try {
        paddle.Checkout.open({
          items: [{ priceId: activeCheckout.priceId, quantity: 1 }],
          customer: session?.user?.email ? { email: session.user.email } : undefined,
          customData: {
            userId: session?.user?.id,
            checkoutSessionId: activeCheckout.sessionId,
          },
          settings: {
            variant: 'one-page',
            theme: 'dark',
            displayMode: 'inline',
            frameTarget: 'paddle-checkout-frame',
            frameInitialHeight: 480,
            frameStyle: 'width: 100%; min-height: 480px; background-color: transparent; border: none',
            successUrl: `${window.location.origin}/dashboard/billing?success=${activeCheckout.itemType}`,
          },
        })
      } catch (err) {
        console.error('[Paddle inline open error]', err)
        setIsCheckoutLoading(false)
      }
    }, 120)

    return () => clearTimeout(timer)
  }, [activeCheckout, paddle, session?.user])

  function handleCloseCheckout() {
    if (activeCheckout?.sessionId) {
      fetch('/api/billing/track-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'abandoned',
          checkoutSessionId: activeCheckout.sessionId,
        }),
      }).catch(() => {})
    }
    setActiveCheckout(null)
    setIsCheckoutLoading(false)
  }

  const displayCredits = liveCredits ?? session?.user?.credits ?? 0
  const userRole = (session?.user?.role ?? 'FREE').toUpperCase()

  const searchParams = useSearchParams()
  const isSuccess = Boolean(searchParams.get('success'))
  const isSuccessPack = searchParams.get('success') === 'pack' || searchParams.get('success') === 'whop_pack'
  const addedCredits = searchParams.get('credits')

  async function startCheckout(type: 'plan' | 'pack', id: string) {
    setError('')
    setLoading(id)

    try {
      let p = paddle
      if (!p && process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) {
        try {
          p =
            (await initializePaddle({
              token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
              environment: (process.env.NEXT_PUBLIC_PADDLE_ENV || 'production') as 'sandbox' | 'production',
              eventCallback: handlePaddleEvent,
            })) || null
          if (p) setPaddle(p)
        } catch (initErr) {
          console.warn('[Paddle] Re-init error:', initErr)
        }
      }

      const res = await fetch('/api/billing/paddle-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(type === 'plan' ? { plan: id } : { packId: id }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.priceId) {
        setError(data.error || 'Unable to load checkout. Please try again.')
        setLoading(null)
        return
      }

      // Track checkout initiation for admin recovery / retargeting
      const trackRes = await fetch('/api/billing/track-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initiated',
          ...(type === 'plan' ? { plan: id } : { packId: id }),
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)

      const sessionId = trackRes?.checkoutSessionId || null

      if (type === 'plan') {
        const planDef = PLANS.find((pl) => pl.key === id) || PLANS[1]
        setActiveCheckout({
          itemType: 'plan',
          itemId: id,
          itemName: `${planDef.name} Plan`,
          price: `${planDef.price} / month`,
          credits: planDef.credits,
          features: planDef.items,
          priceId: data.priceId,
          sessionId,
        })
      } else {
        const packDef = CREDIT_PACKS.find((pk) => pk.id === id) || CREDIT_PACKS[0]
        setActiveCheckout({
          itemType: 'pack',
          itemId: id,
          itemName: `${packDef.name} Pack`,
          price: packDef.price,
          credits: `${packDef.credits} Credits (Never Expire)`,
          features: [
            `${packDef.credits} Credits instantly added to balance`,
            'No monthly recurring fees',
            'Full 1080p high-bitrate export quality',
            'All 18 subtitle presets & Arabic Luxury',
          ],
          priceId: data.priceId,
          sessionId,
        })
      }

      setLoading(null)
    } catch (err: unknown) {
      console.error('Checkout error:', err)
      setError('An unexpected error occurred while starting checkout. Please try again.')
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

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Credits balance */}
      <div className="glass-card mt-8 flex flex-wrap items-center justify-between gap-6 !p-8">
        <div>
          <p className="text-sm font-light text-mist">Credits Remaining</p>
          <p className="stat-value mt-1">{displayCredits}</p>
          <div className="mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-pearl/10">
            <div
              className="h-full bg-gradient-to-r from-champagne to-gold transition-all duration-500"
              style={{ width: `${Math.min(100, (displayCredits / 100) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-light text-mist-2">
            1 credit = 1 final video clip (candidates are free to preview &amp; trim)
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-mist-2">Current Tier</span>
            <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-0.5 text-xs font-semibold text-gold">
              {userRole}
            </span>
          </div>
          <p className="text-xs font-light text-mist">
            {userRole === 'FREE'
              ? 'Upgrade to remove watermark and unlock 1080p exports.'
              : 'Active subscription with full features unlocked.'}
          </p>
          {userRole !== 'FREE' && (
            <Link
              href={hasPaddleCustomer ? '/api/billing/paddle-portal' : '/api/billing/portal'}
              className="btn-lux btn-outline text-xs !py-1.5"
            >
              {hasPaddleCustomer ? 'Paddle Customer Portal' : 'Customer Billing Portal'}
            </Link>
          )}
        </div>
      </div>

      {/* Referral Card */}
      {referral && (
        <div className="glass-card mt-6 border-gold/30 bg-gradient-to-r from-gold/10 via-surface to-surface !p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20 text-gold">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-pearl">Invite Friends, Earn 5 Free Credits Each</p>
                <p className="text-xs text-mist">
                  Share your link. When a creator signs up, you both get +5 complimentary credits.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-mist">Earned Credits</p>
                <p className="font-mono text-lg font-bold text-gold">+{referral.earnedCredits}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-mist">Signups</p>
                <p className="font-mono text-lg font-bold text-pearl">{referral.signupsCount}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-hair/60 bg-onyx-2 p-2">
            <input
              type="text"
              readOnly
              value={referral.referralUrl}
              className="flex-1 bg-transparent px-2 font-mono text-xs text-mist-2 focus:outline-none"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(referral.referralUrl)
                setCopiedRef(true)
                setTimeout(() => setCopiedRef(false), 2000)
              }}
              className="btn-lux btn-gold flex items-center gap-1.5 !px-3 !py-1.5 text-xs font-semibold"
            >
              {copiedRef ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy Link
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Plans grid */}
      <div className="mt-14">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-champagne">Choose Your Tier</p>
          <h2 className="display-sm mt-2">Subscription Plans</h2>
          <p className="mt-2 text-sm font-light text-mist">
            Cancel or change plans anytime. Powered securely by Paddle, our global Merchant of Record.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = userRole === plan.role && !(plan.key === 'free' && userRole !== 'FREE')
            const isFree = plan.key === 'free'

            return (
              <div
                key={plan.key}
                className={`relative flex flex-col justify-between rounded-2xl border p-6 transition-all ${
                  plan.featured
                    ? 'border-gold bg-gold/5 shadow-xl shadow-gold/5'
                    : 'border-hair/50 bg-onyx-2 hover:border-hair'
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-gold bg-gold px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                    RECOMMENDED
                  </span>
                )}

                <div>
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-lg font-semibold text-pearl">{plan.name}</h3>
                    {isCurrent && (
                      <span className="text-[10px] uppercase tracking-wider text-champagne">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold text-pearl">{plan.price}</span>
                    <span className="text-xs text-mist">{plan.period}</span>
                  </div>
                  <p className="mt-1 text-xs font-mono text-champagne">{plan.credits}</p>

                  <ul className="mt-6 space-y-2.5 border-t border-hair/50 pt-6 text-xs text-mist">
                    {plan.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-gold" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {isFree ? (
                  <div className="mt-8 border-t border-hair/40 pt-4 text-center text-xs font-light text-mist-2">
                    Default plan on signup
                  </div>
                ) : (
                  <div className="mt-8 space-y-2 border-t border-hair/40 pt-4">
                    <button
                      onClick={() => startCheckout('plan', plan.key)}
                      disabled={loading !== null || isCurrent}
                      className={`btn-lux w-full text-xs font-semibold ${
                        plan.featured ? 'btn-gold' : 'btn-outline'
                      } disabled:opacity-50`}
                    >
                      {loading === plan.key ? 'Loading…' : isCurrent ? 'Active Plan' : `Select ${plan.name}`}
                    </button>
                    <p className="text-center text-[11px] leading-tight text-mist-2">
                      Instant activation · Cancel anytime
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
                onClick={() => startCheckout('pack', pack.id)}
                disabled={loading !== null}
                className={`btn-lux mt-6 w-full text-xs font-semibold ${
                  pack.popular ? 'btn-gold' : 'btn-outline'
                } disabled:opacity-50`}
              >
                {loading === pack.id ? 'Loading…' : `Buy ${pack.credits} Credits`}
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

      {/* ========================================================================= */}
      {/* LUXURY EMBEDDED INLINE CHECKOUT MODAL */}
      {/* ========================================================================= */}
      {activeCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-onyx/85 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="relative flex flex-col w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-3xl border border-hair/80 bg-onyx-2 shadow-2xl shadow-black/90">
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-hair/50 px-6 py-4 bg-surface/30">
              <div className="flex items-center gap-3">
                <Wordmark size={24} />
                <div className="h-4 w-px bg-hair/60" />
                <div className="flex items-center gap-1.5 text-xs text-mist">
                  <Lock className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Encrypted 256-Bit SSL · Merchant of Record: Paddle</span>
                </div>
              </div>

              <button
                onClick={handleCloseCheckout}
                aria-label="Close checkout"
                className="rounded-full border border-hair/60 p-1.5 text-mist transition-colors hover:bg-surface hover:text-pearl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Split Screen Modal Body */}
            <div className="grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[380px_1fr]">
              {/* Left Column: Order Summary & Luxury Guarantee */}
              <div className="flex flex-col justify-between border-b md:border-b-0 md:border-r border-hair/50 bg-gradient-to-b from-surface/40 to-surface/10 p-6 md:p-8">
                <div>
                  <span className="rounded-full border border-forge/40 bg-forge/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-forge">
                    {activeCheckout.itemType === 'plan' ? 'Subscription Tier' : 'Credit Top-Up'}
                  </span>

                  <h3 className="font-display text-2xl font-bold text-pearl mt-3">
                    {activeCheckout.itemName}
                  </h3>

                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-gold">
                      {activeCheckout.price}
                    </span>
                  </div>

                  <p className="mt-1 font-mono text-xs text-champagne">
                    {activeCheckout.credits}
                  </p>

                  <div className="mt-6 border-t border-hair/50 pt-5">
                    <p className="text-xs uppercase tracking-widest text-mist-2 font-semibold mb-3">
                      Included With Your Purchase:
                    </p>
                    <ul className="space-y-2.5 text-xs text-mist">
                      {activeCheckout.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 shrink-0 text-forge mt-0.5" />
                          <span className="text-pearl/90">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="mt-8 space-y-3 border-t border-hair/50 pt-5 text-[11px] text-mist-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Official Paddle Merchant of Record transaction</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-gold shrink-0" />
                    <span>Instant automatic credit and feature activation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-mist shrink-0" />
                    <span>Taxes and VAT handled automatically by region</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Native Embedded Paddle Checkout Frame */}
              <div className="relative flex flex-col justify-center min-h-[500px] p-4 sm:p-8 bg-onyx-2">
                {/* Loading state indicator */}
                {isCheckoutLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-onyx-2/95 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-forge" />
                    <p className="text-sm font-medium text-pearl">
                      Connecting securely to Paddle…
                    </p>
                    <p className="text-xs text-mist">Preparing your payment gateway</p>
                  </div>
                )}

                {/* The Paddle iframe target container */}
                <div className="paddle-checkout-frame w-full min-h-[480px]" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
