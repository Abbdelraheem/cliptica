import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: {
      create: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
  PLANS: {
    clipper: {
      name: 'Clipper',
      priceId: 'price_test_clipper',
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { GET as checkoutGET } from '@/app/api/billing/checkout/route'
import { GET as portalGET } from '@/app/api/billing/portal/route'

describe('Billing Redirects and Error Safe URLs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('checkout: unauthenticated user redirects safely to /login', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/billing/checkout?plan=clipper')
    const res = await checkoutGET(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toContain('/login?callbackUrl=/dashboard/billing')
  })

  it('checkout: invalid plan redirects safely to error=invalid_plan', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', email: 'test@example.com' },
      expires: '2099-01-01',
    })

    const req = new Request('http://localhost:3000/api/billing/checkout?plan=non_existent')
    const res = await checkoutGET(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toContain('/dashboard/billing?error=invalid_plan')
  })

  it('portal: unauthenticated user redirects safely to /login', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/billing/portal')
    const res = await portalGET(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toContain('/login')
  })

  it('portal: user without stripeCustomerId redirects safely to error=no_customer', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', email: 'test@example.com' },
      expires: '2099-01-01',
    })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      stripeCustomerId: null,
    } as any)

    const req = new Request('http://localhost:3000/api/billing/portal')
    const res = await portalGET(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toContain('/dashboard/billing?error=no_customer')
  })
})
