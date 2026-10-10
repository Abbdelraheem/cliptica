import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockAuth,
  mockSubmissionAggregate,
  mockClipAggregate,
  mockPayoutAggregate,
  mockPayoutCreate,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockSubmissionAggregate: vi.fn(),
  mockClipAggregate: vi.fn(),
  mockPayoutAggregate: vi.fn(),
  mockPayoutCreate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('@/lib/rate-limit', () => ({
  apiMutationLimiter: null,
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/prisma', () => {
  const tx = {
    campaignSubmission: { aggregate: mockSubmissionAggregate },
    campaignClip: { aggregate: mockClipAggregate },
    payout: { aggregate: mockPayoutAggregate, create: mockPayoutCreate },
  }
  return {
    prisma: {
      $transaction: (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
      campaign: { findFirst: vi.fn().mockResolvedValue({ id: 'camp_1' }) },
      clip: { findFirst: vi.fn().mockResolvedValue({ id: 'clip_1' }) },
      ...tx,
    },
  }
})

import { POST } from '@/app/api/payouts/route'

describe('Payout Balance Check Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: 'u_payout_user', email: 'user@example.com' },
    })
  })

  it('rejects with 400 and does NOT create payout when requested amount exceeds available balance', async () => {
    // Total earned: 100, already requested/paid: 60 -> available: 40
    mockSubmissionAggregate.mockResolvedValue({ _sum: { earnings: 100 } })
    mockClipAggregate.mockResolvedValue({ _sum: { estEarnings: 0 } })
    mockPayoutAggregate.mockResolvedValue({ _sum: { amount: 60 } })

    const req = new Request('http://localhost:3000/api/payouts', {
      method: 'POST',
      body: JSON.stringify({
        amount: 50, // exceeds available (40)
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-15T00:00:00.000Z',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Requested amount exceeds your available balance')
    expect(mockPayoutCreate).not.toHaveBeenCalled()
  })

  it('allows creation when requested amount is less than or equal to available balance', async () => {
    // Total earned: 200, already requested/paid: 50 -> available: 150
    mockSubmissionAggregate.mockResolvedValue({ _sum: { earnings: 200 } })
    mockClipAggregate.mockResolvedValue({ _sum: { estEarnings: 0 } })
    mockPayoutAggregate.mockResolvedValue({ _sum: { amount: 50 } })
    mockPayoutCreate.mockResolvedValue({
      id: 'payout_new_123',
      amount: 100,
      status: 'PENDING',
    })

    const req = new Request('http://localhost:3000/api/payouts', {
      method: 'POST',
      body: JSON.stringify({
        amount: 100, // within available (150)
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-15T00:00:00.000Z',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.payout.id).toBe('payout_new_123')
    expect(mockPayoutCreate).toHaveBeenCalledTimes(1)
  })
})
