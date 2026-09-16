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
export const PADDLE_PLAN_PRICES: Record<'clipper' | 'studio', string | undefined> = {
  clipper: process.env.PADDLE_PRICE_CLIPPER_MONTHLY,
  studio: process.env.PADDLE_PRICE_STUDIO_MONTHLY,
}

/**
 * Mapping of Clipzila credit pack keys to Paddle Price IDs.
 */
export const PADDLE_PACK_PRICES: Record<string, string | undefined> = {
  pack_50: process.env.PADDLE_PRICE_PACK_50,
  pack_150: process.env.PADDLE_PRICE_PACK_150,
  pack_500: process.env.PADDLE_PRICE_PACK_500,
}

/**
 * Resolves a plan key ('clipper' | 'studio') from a Paddle Price ID.
 */
export function getPlanFromPaddlePriceId(priceId: string): 'clipper' | 'studio' | null {
  const planPrices: Record<'clipper' | 'studio', string | undefined> = {
    clipper: process.env.PADDLE_PRICE_CLIPPER_MONTHLY || PADDLE_PLAN_PRICES.clipper,
    studio: process.env.PADDLE_PRICE_STUDIO_MONTHLY || PADDLE_PLAN_PRICES.studio,
  }
  for (const [key, id] of Object.entries(planPrices)) {
    if (id && id === priceId) return key as 'clipper' | 'studio'
  }
  return null
}

/**
 * Resolves a CreditPack definition from a Paddle Price ID.
 */
export function getCreditPackFromPaddlePriceId(priceId: string): CreditPackDef | null {
  const packPrices: Record<string, string | undefined> = {
    pack_50: process.env.PADDLE_PRICE_PACK_50 || PADDLE_PACK_PRICES.pack_50,
    pack_150: process.env.PADDLE_PRICE_PACK_150 || PADDLE_PACK_PRICES.pack_150,
    pack_500: process.env.PADDLE_PRICE_PACK_500 || PADDLE_PACK_PRICES.pack_500,
  }
  for (const [key, id] of Object.entries(packPrices)) {
    if (id && id === priceId) return CREDIT_PACKS[key] || null
  }
  return null
}
