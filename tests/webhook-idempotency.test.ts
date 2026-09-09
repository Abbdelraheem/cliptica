import { describe, it, expect, vi, beforeEach } from 'vitest'

const { create, userUpdate, userFindFirst, creditTransactionCreate, constructEvent, subscriptionRetrieve } = vi.hoisted(() => ({
  create: vi.fn(),
  userUpdate: vi.fn(),
  userFindFirst: vi.fn(),
  creditTransactionCreate: vi.fn(),
  constructEvent: vi.fn(),
  subscriptionRetrieve: vi.fn(),
}))

vi.mock('@/lib/prisma', () => {
  const tx = {
    processedWebhookEvent: { create },
    user: { update: userUpdate, findFirst: userFindFirst },
    creditTransaction: { create: creditTransactionCreate },
  }
  return {
    prisma: {
      // Interactive transaction: run the callback against the same mocks.
      $transaction: (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
      ...tx,
    },
  }
})

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent },
    subscriptions: { retrieve: subscriptionRetrieve },
  },
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

function makeInvoiceEvent(id: string) {
  return {
    id,
    type: 'invoice.payment_succeeded',
    data: {
      object: {
        id: 'inv_1',
        customer: 'cus_1',
        subscription: 'sub_1',
        lines: { data: [{ price: { id: 'price_x' } }] },
      },
    },
  }
}

describe('Stripe webhook idempotency (atomic insert-first transaction)', () => {
  beforeEach(() => {
    create.mockReset()
    userUpdate.mockReset()
    userFindFirst.mockReset()
    creditTransactionCreate.mockReset()
    constructEvent.mockReset()
    subscriptionRetrieve.mockReset()
    create.mockResolvedValue({})
    userUpdate.mockResolvedValue({})
    userFindFirst.mockResolvedValue({ id: 'u1' })
    creditTransactionCreate.mockResolvedValue({})
    subscriptionRetrieve.mockResolvedValue({
      id: 'sub_1',
      metadata: { userId: 'u1' },
      items: { data: [{ price: { id: 'price_x' } }] },
    })
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
    constructEvent.mockReturnValue(makeInvoiceEvent('evt_race'))

    await jsonRes(await POST(makeRequest()))

    expect(create).toHaveBeenCalledWith({ data: { stripeEventId: 'evt_race' } })
    // Insert must happen first: its call order precedes every side effect.
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(userUpdate.mock.invocationCallOrder[0])
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(
      creditTransactionCreate.mock.invocationCallOrder[0]
    )
  })

  it('processes checkout and invoice events exactly once on success', async () => {
    // Checkout maps role without granting double credits
    constructEvent.mockReturnValue(makeEvent('evt_checkout'))
    const res1 = await jsonRes(await POST(makeRequest()))
    expect(res1.status).toBe(200)
    expect(res1.body).toEqual({ received: true })
    expect(userUpdate).toHaveBeenCalledTimes(1)
    expect(creditTransactionCreate).not.toHaveBeenCalled()

    // Invoice renewal grants credits and writes transaction
    userUpdate.mockClear()
    creditTransactionCreate.mockClear()
    constructEvent.mockReturnValue(makeInvoiceEvent('evt_invoice'))
    const res2 = await jsonRes(await POST(makeRequest()))
    expect(res2.status).toBe(200)
    expect(res2.body).toEqual({ received: true })
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
