import { describe, it, expect } from 'vitest'
import { PLANS } from '@/lib/stripe'

// Technical direct unit costs per source minute
export const COST_RATES = {
  whisperPerMin: 0.111 / 60, // $0.00185
  llmScoringPerMin: 0.0006, // $0.00060 (Groq Llama 3.3 70B)
  storagePerMinMonth: 0.000135, // Cloudflare R2: 6 clips/10 min = 9MB/min = ~0.009GB * $0.015
  ec2ComputePerMin: (0.17 / 60) * 0.25, // AWS EC2 c6i.xlarge @ $0.17/hr, 0.25 min wall-clock per video min
}

export function calcDirectInfraCostPerMin(): number {
  return (
    COST_RATES.whisperPerMin +
    COST_RATES.llmScoringPerMin +
    COST_RATES.storagePerMinMonth +
    COST_RATES.ec2ComputePerMin
  )
}

export function calcStripeFee(priceInCents: number): number {
  if (priceInCents === 0) return 0
  const priceInDollars = priceInCents / 100
  return priceInDollars * 0.029 + 0.3
}

export function calcTierEconomics(planKey: 'clipper' | 'studio') {
  const plan = PLANS[planKey]
  const revenue = plan.price / 100
  const stripeFee = calcStripeFee(plan.price)
  const infraCost = plan.credits * calcDirectInfraCostPerMin()
  const totalCogs = stripeFee + infraCost
  const grossProfit = revenue - totalCogs
  const grossMargin = grossProfit / revenue
  return {
    revenue,
    stripeFee,
    infraCost,
    totalCogs,
    grossProfit,
    grossMargin,
  }
}

describe('Pricing Model & Unit Economics', () => {
  it('verifies fully-loaded infrastructure cost per minute is under $0.005', () => {
    const costPerMin = calcDirectInfraCostPerMin()
    // Expected around ~$0.0033
    expect(costPerMin).toBeGreaterThan(0.002)
    expect(costPerMin).toBeLessThan(0.005)
  })

  it('verifies Free tier exposure is capped under $0.20 per user lifetime', () => {
    const freePlan = PLANS.free
    const freeInfraCost = freePlan.credits * calcDirectInfraCostPerMin()
    expect(freeInfraCost).toBeLessThan(0.2) // ~$0.13
  })

  it('guarantees Clipper tier gross margin exceeds 60% (target >= 60%)', () => {
    const eco = calcTierEconomics('clipper')
    expect(eco.revenue).toBe(19.0)
    expect(eco.stripeFee).toBeCloseTo(0.851, 2)
    expect(eco.totalCogs).toBeLessThan(2.5) // Total COGS is under $2.50
    expect(eco.grossMargin).toBeGreaterThan(0.6) // Margin > 60%
    expect(eco.grossMargin).toBeGreaterThan(0.85) // Actually > 85%
  })

  it('guarantees Studio tier gross margin exceeds 60% (target >= 60%)', () => {
    const eco = calcTierEconomics('studio')
    expect(eco.revenue).toBe(49.0)
    expect(eco.stripeFee).toBeCloseTo(1.721, 2)
    expect(eco.totalCogs).toBeLessThan(7.0) // Total COGS is under $7.00
    expect(eco.grossMargin).toBeGreaterThan(0.6) // Margin > 60%
    expect(eco.grossMargin).toBeGreaterThan(0.85) // Actually > 85%
  })

  it('verifies fast clip adjustment COGS is under $0.001 and margin is > 95%', () => {
    // 8 seconds of EC2 CPU encoding time
    const adjustCpuCost = (8 / 3600) * 0.17
    const adjustStorageCost = (15 / 1024) * 0.015
    const adjustTotalCost = adjustCpuCost + adjustStorageCost

    expect(adjustTotalCost).toBeLessThan(0.001) // Less than a tenth of a cent ($0.0004)

    // 1 credit value in Clipper plan ($19 / 300 = $0.0633)
    const creditValue = 19 / 300
    const margin = (creditValue - adjustTotalCost) / creditValue
    expect(margin).toBeGreaterThan(0.95) // > 95% margin
  })
})
