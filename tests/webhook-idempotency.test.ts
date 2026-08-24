import { describe, it, expect, vi, beforeEach } from 'vitest'

const { create, userUpdate, creditTransactionCreate, constructEvent } = vi.hoisted(() => ({
  create: vi.fn(),
  userUpdate: vi.fn(),
  creditTransactionCreate: vi.fn(),
  constructEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    processedWebhookEvent: { create },
    user: { update: userUpdate },
    creditTransaction: { create: creditTransactionCreate },
  },
}))

vi.mock('@/lib/stripe', () => ({
  stripe: { webhooks: { constructEvent } },
  PLANS: { clipper: { name: 'Clipper', credits: 300, priceId: 'price_x' } },
  getPlanFromPriceId: () => 'clipper',
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'stripe-signature': 'sig_test' }),
}))

function p2002Error() {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
}

import { POST } from '@/app/api/billing/webhook/route'

function jsonRes(res: Response) {
  return res.json().then((d) => ({ status: res.status, body: d }))
}

function makeEvent(id: string, type = 'checkout.session.completed') {
  return {
    id,
    type,
    data: {
      object: {
        metadata: { userId: 'u1', plan: 'clipper' },
        customer: 'cus_1',
        subscription: 'sub_1',
      },
    },
  }
}

function makeRequest() {
  return new Request('http://localhost/api/billing/webhook', {
    method: 'POST',
    body: '{}',
  })
}

describe('Stripe webhook idempotency (atomic insert-first)', () => {
  beforeEach(() => {
    create.mockReset()
    userUpdate.mockReset()
    creditTransactionCreate.mockReset()
    constructEvent.mockReset()
    create.mockResolvedValue({})
    userUpdate.mockResolvedValue({})
    creditTransactionCreate.mockResolvedValue({})
  })

  it('rejects events that fail signature verification with 400', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('bad signature')
    })
    const { status } = await jsonRes(await POST(makeRequest()))
    expect(status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('short-circuits duplicates via P2002 without any side effects', async () => {
    constructEvent.mockReturnValue(makeEvent('evt_dup'))
    create.mockRejectedValue(p2002Error())

    const { status, body } = await jsonRes(await POST(makeRequest()))

    expect(status).toBe(200)
    expect(body).toEqual({ received: true, duplicate: true })
    // The event was never processed — no credits granted, no plan change.
    expect(userUpdate).not.toHaveBeenCalled()
    expect(creditTransactionCreate).not.toHaveBeenCalled()
  })

  it('records the event BEFORE processing so concurrent retries lose the race', async () => {
    constructEvent.mockReturnValue(makeEvent('evt_race'))

    await jsonRes(await POST(makeRequest()))

    expect(create).toHaveBeenCalledWith({ data: { stripeEventId: 'evt_race' } })
    // Insert must happen first: its call order precedes every side effect.
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(userUpdate.mock.invocationCallOrder[0])
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(
      creditTransactionCreate.mock.invocationCallOrder[0]
    )
  })

  it('processes a fresh event exactly once on success', async () => {
    constructEvent.mockReturnValue(makeEvent('evt_new'))

    const { status, body } = await jsonRes(await POST(makeRequest()))

    expect(status).toBe(200)
    expect(body).toEqual({ received: true })
    expect(userUpdate).toHaveBeenCalledTimes(1)
    expect(creditTransactionCreate).toHaveBeenCalledTimes(1)
  })

  it('propagates non-P2002 insert errors as a 500 (not treated as duplicate)', async () => {
    constructEvent.mockReturnValue(makeEvent('evt_dbdown'))
    create.mockRejectedValue(new Error('connection refused'))

    const { status, body } = await jsonRes(await POST(makeRequest()))

    expect(status).toBe(500)
    expect(body).toEqual({ error: 'Webhook handler failed' })
    expect(userUpdate).not.toHaveBeenCalled()
  })
})
