import { Environment, LogLevel, Paddle } from '@paddle/paddle-node-sdk'
import { CREDIT_PACKS, type CreditPackDef } from './stripe'

let paddleInstance: Paddle | null = null

/**
 * Returns a configured Paddle Node SDK client instance.
 */
export function getPaddleInstance(): Paddle {
  if (paddleInstance) return paddleInstance

  const apiKey = process.env.PADDLE_API_KEY || ''
  const isProduction = process.env.NEXT_PUBLIC_PADDLE_ENV === 'production'

  paddleInstance = new Paddle(apiKey, {
    environment: isProduction ? Environment.production : Environment.sandbox,
    logLevel: LogLevel.error,
  })

  return paddleInstance
}

/**
 * Mapping of Clipzila plan keys to Paddle Price IDs.
 */
export const PADDLE_PLAN_PRICES: Record<string, string> = {
  basic: process.env.PADDLE_PRICE_BASIC || 'pri_01m2wsjgyn37f85t920yeqpkjs',
  starter: process.env.PADDLE_PRICE_CLIPPER_MONTHLY || 'pri_01m2wsnkn3qeswx68fx71c1p6y',
  clipper: process.env.PADDLE_PRICE_CLIPPER_MONTHLY || 'pri_01m2wsnkn3qeswx68fx71c1p6y',
  pro: process.env.PADDLE_PRICE_STUDIO_MONTHLY || 'pri_01m2wsscq76fefjd7sfkf1awnv',
  studio: process.env.PADDLE_PRICE_STUDIO_MONTHLY || 'pri_01m2wsscq76fefjd7sfkf1awnv',
}

/**
 * Mapping of Clipzila credit pack keys to Paddle Price IDs.
 */
export const PADDLE_PACK_PRICES: Record<string, string> = {
  pack_50: process.env.PADDLE_PRICE_PACK_50 || 'pri_01m2x2qyx780p7crsd2p2ggmm1',
  pack_150: process.env.PADDLE_PRICE_PACK_150 || 'pri_01m2x2t7vp1ajkpq1w2be4s47w',
  pack_500: process.env.PADDLE_PRICE_PACK_500 || 'pri_01m2x2xa5wvsxnhq990vyrycan',
}

/**
 * Resolves a plan key ('basic' | 'clipper' | 'studio') from a Paddle Price ID.
 */
export function getPlanFromPaddlePriceId(priceId: string): 'basic' | 'clipper' | 'studio' | null {
  if (priceId === PADDLE_PLAN_PRICES.basic || priceId.includes('basic')) return 'basic'
  if (priceId === PADDLE_PLAN_PRICES.starter || priceId === PADDLE_PLAN_PRICES.clipper || priceId.includes('clipper') || priceId.includes('starter')) return 'clipper'
  if (priceId === PADDLE_PLAN_PRICES.pro || priceId === PADDLE_PLAN_PRICES.studio || priceId.includes('studio') || priceId.includes('pro')) return 'studio'
  for (const [key, id] of Object.entries(PADDLE_PLAN_PRICES)) {
    if (id === priceId) {
      if (key === 'basic') return 'basic'
      if (key === 'starter' || key === 'clipper') return 'clipper'
      if (key === 'pro' || key === 'studio') return 'studio'
    }
  }
  return null
}

/**
 * Resolves a CreditPack definition from a Paddle Price ID.
 */
export function getCreditPackFromPaddlePriceId(priceId: string): CreditPackDef | null {
  for (const [key, id] of Object.entries(PADDLE_PACK_PRICES)) {
    if (id && id === priceId) return CREDIT_PACKS[key] || null
  }
  if (priceId.includes('pack500') || priceId.includes('pack_500')) return CREDIT_PACKS['pack_500'] || null
  if (priceId.includes('pack150') || priceId.includes('pack_150')) return CREDIT_PACKS['pack_150'] || null
  if (priceId.includes('pack50') || priceId.includes('pack_50')) return CREDIT_PACKS['pack_50'] || null
  return null
}
