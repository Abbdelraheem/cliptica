import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  processedWebhookEventCreate,
  userUpdate,
  creditTransactionCreate,
} = vi.hoisted(() => ({
  processedWebhookEventCreate: vi.fn(),
  userUpdate: vi.fn(),
  creditTransactionCreate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => {
  const tx = {
    processedWebhookEvent: { create: processedWebhookEventCreate, findUnique: vi.fn() },
    user: { update: userUpdate, findFirst: vi.fn(), findUnique: vi.fn() },
    creditTransaction: { create: creditTransactionCreate },
  }
  return {
    prisma: {
      $transaction: (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
      ...tx,
    },
  }
})

vi.mock('next/headers', () => ({
  headers: async () => new Headers({
    'webhook-signature': 'v1,invalidsignature123456789',
    'webhook-id': 'msg_123',
    'webhook-timestamp': '1234567890',
  }),
}))

import { POST } from '@/app/api/billing/whop-webhook/route'

describe('Whop Webhook Fail-Closed Security', () => {
  const origEnv = process.env.WHOP_WEBHOOK_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.WHOP_WEBHOOK_SECRET
  })

  afterEach(() => {
    if (origEnv !== undefined) {
      process.env.WHOP_WEBHOOK_SECRET = origEnv
    } else {
      delete process.env.WHOP_WEBHOOK_SECRET
    }
  })

  it('returns 503 and performs zero writes when WHOP_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.WHOP_WEBHOOK_SECRET

    const req = new Request('http://localhost:3000/api/billing/whop-webhook', {
      method: 'POST',
      body: JSON.stringify({ action: 'payment.succeeded', id: 'evt_1' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.error).toBe('Webhook not configured')

    expect(processedWebhookEventCreate).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
    expect(creditTransactionCreate).not.toHaveBeenCalled()
  })

  it('returns 400 and performs zero writes when secret is set but signature is invalid', async () => {
    process.env.WHOP_WEBHOOK_SECRET = 'whsec_test_secret_123'

    const req = new Request('http://localhost:3000/api/billing/whop-webhook', {
      method: 'POST',
      body: JSON.stringify({ action: 'payment.succeeded', id: 'evt_1' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid webhook signature')

    expect(processedWebhookEventCreate).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
    expect(creditTransactionCreate).not.toHaveBeenCalled()
  })
})
