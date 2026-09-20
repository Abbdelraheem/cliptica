import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// Mock rate limit
vi.mock('@/lib/rate-limit', () => ({
  apiMutationLimiter: null,
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

// Mock prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  campaign: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

describe('Campaign Management API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: 'user_test_123', email: 'creator@clipzila.com' },
    })
    mockPrisma.user.findUnique.mockResolvedValue({
      role: 'ADMIN',
      canCreateCampaigns: true,
    })
  })

  it('POST /api/campaigns creates a clipping campaign with platform and custom rate', async () => {
    const { POST } = await import('@/app/api/campaigns/route')

    const newCampaign = {
      id: 'camp_1',
      userId: 'user_test_123',
      name: 'Whop AI Content Rewards',
      type: 'WHOP_CONTENT_REWARDS',
      platform: 'tiktok',
      ratePer1k: 2.50,
      budget: 500,
      flatFee: 50,
      deadline: new Date('2026-12-31T00:00:00.000Z'),
      isActive: true,
    }

    mockPrisma.campaign.create.mockResolvedValue(newCampaign)

    const request = new Request('http://localhost/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Whop AI Content Rewards',
        type: 'WHOP_CONTENT_REWARDS',
        platform: 'tiktok',
        ratePer1k: 2.50,
        budget: 500,
        flatFee: 50,
        deadline: '2026-12-31T00:00:00.000Z',
      }),
    })

    const res = await POST(request)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.campaign.name).toBe('Whop AI Content Rewards')
    expect(json.campaign.platform).toBe('tiktok')
    expect(mockPrisma.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user_test_123',
          name: 'Whop AI Content Rewards',
          platform: 'tiktok',
          ratePer1k: 2.50,
        }),
      })
    )
  })

  it('GET /api/campaigns returns user campaigns', async () => {
    const { GET } = await import('@/app/api/campaigns/route')

    mockPrisma.campaign.findMany.mockResolvedValue([
      {
        id: 'camp_1',
        name: 'Whop Rewards',
        type: 'WHOP_CONTENT_REWARDS',
        platform: 'tiktok',
        ratePer1k: 1.5,
        isActive: true,
        _count: { clips: 3 },
        clips: [{ views: 12000, estEarnings: 18.00 }],
      },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.campaigns).toHaveLength(1)
    expect(json.campaigns[0].platform).toBe('tiktok')
  })

  it('PATCH /api/campaigns/[id] toggles active status of a campaign', async () => {
    const { PATCH } = await import('@/app/api/campaigns/[id]/route')

    mockPrisma.campaign.findFirst.mockResolvedValue({
      id: 'camp_1',
      userId: 'user_test_123',
      isActive: true,
    })

    mockPrisma.campaign.update.mockResolvedValue({
      id: 'camp_1',
      userId: 'user_test_123',
      isActive: false,
    })

    const request = new Request('http://localhost/api/campaigns/camp_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })

    const res = await PATCH(request, { params: Promise.resolve({ id: 'camp_1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.campaign.isActive).toBe(false)
  })

  it('DELETE /api/campaigns/[id] deletes the user campaign', async () => {
    const { DELETE } = await import('@/app/api/campaigns/[id]/route')

    mockPrisma.campaign.findFirst.mockResolvedValue({
      id: 'camp_1',
      userId: 'user_test_123',
    })

    mockPrisma.campaign.delete.mockResolvedValue({ id: 'camp_1' })

    const request = new Request('http://localhost/api/campaigns/camp_1', {
      method: 'DELETE',
    })

    const res = await DELETE(request, { params: Promise.resolve({ id: 'camp_1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockPrisma.campaign.delete).toHaveBeenCalledWith({
      where: { id: 'camp_1' },
    })
  })

  it('POST /api/campaigns returns 403 when user is not admin and canCreateCampaigns is false', async () => {
    const { POST } = await import('@/app/api/campaigns/route')

    mockPrisma.user.findUnique.mockResolvedValue({
      role: 'USER',
      canCreateCampaigns: false,
    })

    const request = new Request('http://localhost/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unauthorized Campaign',
        type: 'WHOP_CONTENT_REWARDS',
        platform: 'tiktok',
        ratePer1k: 2.50,
      }),
    })

    const res = await POST(request)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('restricted to administrators and authorized partners')
  })

  it('POST /api/campaigns succeeds for non-admin user when canCreateCampaigns is true', async () => {
    const { POST } = await import('@/app/api/campaigns/route')

    mockPrisma.user.findUnique.mockResolvedValue({
      role: 'USER',
      canCreateCampaigns: true,
    })

    const newCampaign = {
      id: 'camp_authorized',
      userId: 'user_test_123',
      name: 'Authorized Partner Campaign',
      type: 'WHOP_CONTENT_REWARDS',
      platform: 'youtube',
      ratePer1k: 3.0,
      isActive: true,
    }
    mockPrisma.campaign.create.mockResolvedValue(newCampaign)

    const request = new Request('http://localhost/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Authorized Partner Campaign',
        type: 'WHOP_CONTENT_REWARDS',
        platform: 'youtube',
        ratePer1k: 3.0,
      }),
    })

    const res = await POST(request)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.campaign.name).toBe('Authorized Partner Campaign')
  })
})

