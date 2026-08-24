import { describe, it, expect, vi, beforeEach } from 'vitest'

const { findUnique, create, userUpdate, creditTransactionCreate, constructEvent } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  userUpdate: vi.fn(),
  creditTransactionCreate: vi.fn(),
  constructEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    processedWebhookEvent: { findUnique, create },
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

describe('Stripe webhook idempotency', () => {
  beforeEach(() => {
    findUnique.mockReset()
    create.mockReset()
    userUpdate.mockReset()
    creditTransactionCreate.mockReset()
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
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('short-circuits duplicate events without re-processing them', async () => {
    const evt = makeEvent('evt_dup')
    constructEvent.mockReturnValue(evt)
    findUnique.mockResolvedValue({ id: 'c1', stripeEventId: 'evt_dup' })

    const { status, body } = await jsonRes(await POST(makeRequest()))

    expect(status).toBe(200)
    expect(body).toEqual({ received: true, duplicate: true })
    // Nothing was charged and nothing new recorded.
    expect(userUpdate).not.toHaveBeenCalled()
    expect(creditTransactionCreate).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('processes a fresh event exactly once and records its stripeEventId', async () => {
    const evt = makeEvent('evt_new')
    constructEvent.mockReturnValue(evt)
    findUnique.mockResolvedValue(null)

    const { status, body } = await jsonRes(await POST(makeRequest()))

    expect(status).toBe(200)
    expect(body).toEqual({ received: true })
    expect(userUpdate).toHaveBeenCalledTimes(1)
    expect(creditTransactionCreate).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({ data: { stripeEventId: 'evt_new' } })
  })

  it('checks the event id against the unique stripeEventId column', async () => {
    constructEvent.mockReturnValue(makeEvent('evt_lookup'))
    findUnique.mockResolvedValue(null)

    await POST(makeRequest())

    expect(findUnique).toHaveBeenCalledWith({ where: { stripeEventId: 'evt_lookup' } })
  })
})
