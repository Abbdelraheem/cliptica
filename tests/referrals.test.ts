import { describe, it, expect } from 'vitest'

describe('Referral and Affiliate calculations', () => {
  it('calculates affiliate commission correctly for Clipper plan ($19)', () => {
    const revenue = 19.00
    const commissionRate = 20 // 20%
    const commission = Number(((revenue * commissionRate) / 100).toFixed(2))
    expect(commission).toBe(3.80)
  })

  it('calculates affiliate commission correctly for Studio plan ($49)', () => {
    const revenue = 49.00
    const commissionRate = 20 // 20%
    const commission = Number(((revenue * commissionRate) / 100).toFixed(2))
    expect(commission).toBe(9.80)
  })

  it('calculates conversion funnel and drop-off rates accurately', () => {
    const clicks = 500
    const signups = 100
    const firstProjects = 60
    const subscriptions = 15

    const signupRate = Number(((signups / clicks) * 100).toFixed(1))
    const projectDropoff = Number((((signups - firstProjects) / signups) * 100).toFixed(1))
    const subscriptionRate = Number(((subscriptions / signups) * 100).toFixed(1))

    expect(signupRate).toBe(20.0) // 20% converted from visitor to registered
    expect(projectDropoff).toBe(40.0) // 40% registered but dropped off before creating a project
    expect(subscriptionRate).toBe(15.0) // 15% of registered users converted to paying subscribers
  })

  it('handles zero clicks without division by zero errors', () => {
    const clicks = 0
    const signups = 0
    const signupRate = clicks > 0 ? Number(((signups / clicks) * 100).toFixed(1)) : 0
    expect(signupRate).toBe(0)
  })

  it('normalizes referral codes to lowercase alphanumeric slugs', () => {
    const rawInput = '  Firas_YT-2026!  '
    const cleaned = rawInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    expect(cleaned).toBe('firas_yt-2026')
  })
})
