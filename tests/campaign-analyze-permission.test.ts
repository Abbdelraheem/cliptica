import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/ssrf', () => ({
  assertPublicHttpUrl: vi.fn().mockResolvedValue(new URL('https://example.com/campaign')),
}))

import { POST } from '@/app/api/campaigns/analyze/route'

describe('Campaign Analyze Route Permission Guard', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    mockAuth.mockResolvedValue({
      user: { id: 'u_regular', email: 'user@example.com' },
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 403 Forbidden and makes no fetch or AI calls when user is neither ADMIN nor has canCreateCampaigns', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: 'USER',
      canCreateCampaigns: false,
    })

    const req = new Request('http://localhost:3000/api/campaigns/analyze', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://whop.com/test-campaign' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('Campaign analysis is restricted')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated users with 401 Unauthorized', async () => {
    mockAuth.mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/campaigns/analyze', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://whop.com/test-campaign' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
