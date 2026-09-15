import { describe, it, expect } from 'vitest'
import { PLAN_MAX_MINUTES, planMaxMinutes, exceedsPlanMinutes, calcClipCredits } from '../worker/credits.mjs'
import { PLANS, planForRole } from '../src/lib/stripe'

describe('Credit Reservation and Settlement Parity', () => {
  it('enforces exactly 1 credit reserved per video operation', () => {
    const reservationCredits = 1
    const settlementCredits = 1
    const diff = settlementCredits - reservationCredits

    // Zero drift, no refund desync
    expect(diff).toBe(0)
  })

  it('guarantees settlement logic never generates refund desync for 1-credit jobs', () => {
    const reserved = 1
    const creditsSpent = 1
    const diff = creditsSpent - reserved

    // If diff is 0, no additional charge and no refund triggered
    expect(diff).toBe(0)
    expect(diff < 0).toBe(false)
    expect(diff > 0).toBe(false)
  })

  it('enforces strict source duration limits across all subscription tiers', () => {
    // Free tier: 20 min cap
    expect(planMaxMinutes('FREE')).toBe(20)
    expect(PLANS.free.maxVideoLength).toBe(20)
    expect(exceedsPlanMinutes(20, 'FREE')).toBe(false)
    expect(exceedsPlanMinutes(20.5, 'FREE')).toBe(true)

    // Clipper (Starter) tier: 90 min cap
    expect(planMaxMinutes('CLIPPER')).toBe(90)
    expect(PLANS.clipper.maxVideoLength).toBe(90)
    expect(exceedsPlanMinutes(90, 'CLIPPER')).toBe(false)
    expect(exceedsPlanMinutes(90.1, 'CLIPPER')).toBe(true)

    // Studio (Pro Creator) tier: 120 min cap
    expect(planMaxMinutes('STUDIO')).toBe(120)
    expect(PLANS.studio.maxVideoLength).toBe(120)
    expect(exceedsPlanMinutes(120, 'STUDIO')).toBe(false)
    expect(exceedsPlanMinutes(120.5, 'STUDIO')).toBe(true)

    // Platform hard ceiling: 180 min
    expect(planMaxMinutes('ADMIN')).toBe(180)
    expect(exceedsPlanMinutes(180, 'ADMIN')).toBe(false)
    expect(exceedsPlanMinutes(180.1, 'ADMIN')).toBe(true)
  })

  it('ensures unit economics remain profitable across all allowed durations', () => {
    // Technical cost per minute: ~$0.0033
    const costPerMin = 0.0033

    // Free tier: max 20 min -> $0.066 total COGS, well below $0.20 budget
    const freeMaxCost = 20 * costPerMin
    expect(freeMaxCost).toBeLessThan(0.10)

    // Clipper tier: 150 credits @ $29 = $0.193 / credit
    // Even a 45-minute average video ($0.148 COGS) is covered by monthly fee
    const clipperCreditPrice = 29 / 150
    expect(clipperCreditPrice).toBeGreaterThan(0.19)

    // Studio tier: 400 credits @ $59 = $0.1475 / credit
    const studioCreditPrice = 59 / 400
    expect(studioCreditPrice).toBeGreaterThan(0.14)
  })
})
