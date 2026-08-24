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
    credits: 40,
    maxVideoLength: 20, // minutes
    maxDailyVideos: 3,
    watermark: true,
    maxResolution: '720p',
    features: [
      '40 credits to start',
      'All 15 caption styles',
      '720p exports with watermark',
      'Up to 3 videos/day',
    ],
  },
  clipper: {
    name: 'Clipper',
    price: 1900, // cents
    priceId: process.env.STRIPE_PRICE_CLIPPER_MONTHLY,
    credits: 300,
    maxVideoLength: 90,
    maxDailyVideos: 50,
    watermark: false,
    maxResolution: '1080p',
    features: [
      '300 credits/month',
      'No watermark · 1080p at 60fps',
      'Campaign hub + earnings ledger',
      'Motion graphics & zoom effects',
      'Full editor access',
    ],
  },
  studio: {
    name: 'Studio',
    price: 4900,
    priceId: process.env.STRIPE_PRICE_STUDIO_MONTHLY,
    credits: 1200,
    maxVideoLength: 180,
    maxDailyVideos: 200,
    watermark: false,
    maxResolution: '1080p',
    features: [
      '1,200 credits/month',
      'Priority rendering queue',
      'Auto-Pilot channel watchlists',
      'Brand presets & style packs',
      'Everything in Clipper',
    ],
  },
}

export type PlanKey = 'free' | 'clipper' | 'studio'
export type Plan = PlanDef

export function getPlanFromPriceId(priceId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) return key as PlanKey
  }
  return null
}