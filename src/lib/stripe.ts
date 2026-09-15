import Stripe from 'stripe'

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
  {
    apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
    typescript: true,
  }
)

export interface PlanDef {
  name: string
  price: number
  priceId?: string
  credits: number
  maxVideoLength: number
  maxDailyVideos: number
  watermark: boolean
  maxResolution: string
  features: string[]
}

export const PLANS: Record<PlanKey, PlanDef> = {
  free: {
    name: 'Free',
    price: 0,
    credits: 15,
    maxVideoLength: 20, // minutes
    maxDailyVideos: 3,
    watermark: true,
    maxResolution: '720p',
    features: [
      '15 credits to start',
      'Karaoke captions (Arabic + English)',
      '720p exports with watermark',
      'Up to 3 videos/day',
    ],
  },
  clipper: {
    name: 'Starter',
    price: 2900, // $29 / mo (cents)
    priceId: process.env.STRIPE_PRICE_CLIPPER_MONTHLY || process.env.STRIPE_CLIPPER_PRICE_ID,
    credits: 150,
    maxVideoLength: 90,
    maxDailyVideos: 50,
    watermark: false,
    maxResolution: '1080p',
    features: [
      '150 credits/month',
      'No watermark · 1080p high bitrate',
      'Opening AI Hook cards & Title overlays',
      'Arabic Luxury & Viral kinetic subtitle styles',
      'Campaign hub + full editor access',
    ],
  },
  studio: {
    name: 'Pro Creator',
    price: 5900, // $59 / mo (cents)
    priceId: process.env.STRIPE_PRICE_STUDIO_MONTHLY || process.env.STRIPE_STUDIO_PRICE_ID,
    credits: 400,
    maxVideoLength: 120,
    maxDailyVideos: 200,
    watermark: false,
    maxResolution: '1080p',
    features: [
      '400 credits/month',
      'Ultra-fast priority rendering queue',
      'AI Auto-Pilot channel watchlists',
      'Brand style presets & custom font packs',
      'Full social direct publishing integration',
    ],
  },
}

export interface CreditPackDef {
  id: string
  name: string
  credits: number
  price: number // in cents
  pricePerCredit: string
  popular?: boolean
  description: string
}

export const CREDIT_PACKS: Record<string, CreditPackDef> = {
  pack_50: {
    id: 'pack_50',
    name: '50 Credits',
    credits: 50,
    price: 1500, // $15.00
    pricePerCredit: '$0.30',
    description: 'Perfect for quick testing and short projects',
  },
  pack_150: {
    id: 'pack_150',
    name: '150 Credits',
    credits: 150,
    price: 3500, // $35.00
    pricePerCredit: '$0.23',
    popular: true,
    description: 'Most popular for active content creators',
  },
  pack_500: {
    id: 'pack_500',
    name: '500 Credits',
    credits: 500,
    price: 8900, // $89.00
    pricePerCredit: '$0.17',
    description: 'Best value for high-volume clipping & agencies',
  },
}

export type CreditPackKey = keyof typeof CREDIT_PACKS
export type PlanKey = 'free' | 'clipper' | 'studio'
export type Plan = PlanDef

export function getPlanFromPriceId(priceId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) return key as PlanKey
  }
  return null
}

/** Maps a DB UserRole to its plan definition (ADMIN enjoys Studio limits). */
export function planForRole(role: string): PlanDef | null {
  const map: Record<string, PlanKey> = { FREE: 'free', CLIPPER: 'clipper', STUDIO: 'studio', ADMIN: 'studio' }
  const key = map[role.toUpperCase()]
  return key ? PLANS[key] : null
}