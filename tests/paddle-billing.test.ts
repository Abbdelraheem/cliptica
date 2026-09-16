import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/paddle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/paddle')>()
  return {
    ...actual,
    getPaddleInstance: vi.fn(() => ({
      customerPortalSessions: {
        create: vi.fn().mockResolvedValue({
          urls: {
            general: {
              overview: 'https://customer-portal.paddle.com/session_test_123',
            },
          },
        }),
      },
    })),
    PADDLE_PLAN_PRICES: {
      clipper: 'pri_test_clipper',
      studio: 'pri_test_studio',
    },
    PADDLE_PACK_PRICES: {
      pack_50: 'pri_test_pack50',
      pack_150: 'pri_test_pack150',
      pack_500: 'pri_test_pack500',
    },
  }
})

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST as checkoutPOST } from '@/app/api/billing/paddle-checkout/route'
import { GET as portalGET } from '@/app/api/billing/paddle-portal/route'
import { getPlanFromPaddlePriceId, getCreditPackFromPaddlePriceId } from '@/lib/paddle'

describe('Paddle Billing Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PADDLE_PRICE_CLIPPER_MONTHLY = 'pri_test_clipper'
    process.env.PADDLE_PRICE_STUDIO_MONTHLY = 'pri_test_studio'
    process.env.PADDLE_PRICE_PACK_50 = 'pri_test_pack50'
    process.env.PADDLE_PRICE_PACK_150 = 'pri_test_pack150'
    process.env.PADDLE_PRICE_PACK_500 = 'pri_test_pack500'
  })

  describe('paddle-checkout route', () => {
    it('returns 401 when session is not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)
      const req = new Request('http://localhost:3000/api/billing/paddle-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'clipper' }),
      })
      const res = await checkoutPOST(req)
      expect(res.status).toBe(401)
    })

    it('returns priceId and user details for valid subscription plan', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'usr_paddle_1', email: 'creator@clipzila.com' },
      })
      const req = new Request('http://localhost:3000/api/billing/paddle-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'clipper' }),
      })
      const res = await checkoutPOST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.priceId).toBe('pri_test_clipper')
      expect(data.userId).toBe('usr_paddle_1')
      expect(data.email).toBe('creator@clipzila.com')
    })

    it('returns priceId and user details for valid credit pack', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'usr_paddle_1', email: 'creator@clipzila.com' },
      })
      const req = new Request('http://localhost:3000/api/billing/paddle-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: 'pack_150' }),
      })
      const res = await checkoutPOST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.priceId).toBe('pri_test_pack150')
    })

    it('returns 400 when invalid plan or pack is requested', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'usr_paddle_1', email: 'creator@clipzila.com' },
      })
      const req = new Request('http://localhost:3000/api/billing/paddle-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'super_diamond_plan' }),
      })
      const res = await checkoutPOST(req)
      expect(res.status).toBe(400)
    })
  })

  describe('paddle-portal route', () => {
    it('redirects to /login if not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)
      const req = new Request('http://localhost:3000/api/billing/paddle-portal')
      const res = await portalGET(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/login')
    })

    it('redirects to error=no_paddle_account if user has no paddleCustomerId', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'usr_paddle_1', email: 'creator@clipzila.com' },
      })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        paddleCustomerId: null,
        paddleSubscriptionId: null,
      } as any)

      const req = new Request('http://localhost:3000/api/billing/paddle-portal')
      const res = await portalGET(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/dashboard/billing?error=no_paddle_account')
    })

    it('redirects to Paddle Customer Portal overview URL when paddleCustomerId exists', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'usr_paddle_1', email: 'creator@clipzila.com' },
      })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        paddleCustomerId: 'ctm_12345',
        paddleSubscriptionId: 'sub_12345',
      } as any)

      const req = new Request('http://localhost:3000/api/billing/paddle-portal')
      const res = await portalGET(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toBe('https://customer-portal.paddle.com/session_test_123')
    })
  })

  describe('price resolution helpers', () => {
    it('resolves plans and credit packs correctly', () => {
      expect(getPlanFromPaddlePriceId('pri_test_clipper')).toBe('clipper')
      expect(getPlanFromPaddlePriceId('pri_test_studio')).toBe('studio')
      expect(getPlanFromPaddlePriceId('pri_unknown')).toBeNull()

      expect(getCreditPackFromPaddlePriceId('pri_test_pack50')?.credits).toBe(50)
      expect(getCreditPackFromPaddlePriceId('pri_test_pack150')?.credits).toBe(150)
      expect(getCreditPackFromPaddlePriceId('pri_test_pack500')?.credits).toBe(500)
      expect(getCreditPackFromPaddlePriceId('pri_unknown')).toBeNull()
    })
  })
})
