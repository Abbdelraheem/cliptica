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
const mockPrisma: any = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  project: {
    count: vi.fn(),
    create: vi.fn(),
  },
  processingJob: {
    create: vi.fn(),
  },
  creditTransaction: {
    create: vi.fn(),
  },
}
mockPrisma.$transaction = vi.fn().mockImplementation(async (callback: any) => {
  if (typeof callback === 'function') {
    return callback(mockPrisma)
  }
  return Promise.all(callback)
})
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  withDbRetry: (fn: () => any) => fn(),
}))

// Mock ssrf
vi.mock('@/lib/ssrf', () => ({
  assertPublicHttpUrl: vi.fn().mockResolvedValue(new URL('https://whop.com')),
}))

// Mock ai-provider
vi.mock('@/lib/ai-provider', () => ({
  executeAiChatCompletion: vi.fn().mockResolvedValue({
    parsedJson: {
      title: 'AI Extracted Campaign Title',
      payout: '$0.50 CPM (Up to $500)',
      guidelines: ['Use strong hook', 'High retention clips'],
      requiredHashtags: ['clipfarm', 'viral'],
      recommendedInstructions: 'Fast paced kinetic cuts',
      recommendedCaptionStyle: 'hormozi',
    },
  }),
}))

describe('Whop & Content Rewards Campaign Ingestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: 'usr_test_whop', email: 'test@cliptica.com' },
    })
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'usr_test_whop',
      credits: 10,
      role: 'PRO',
      referredByAffiliateId: null,
    })
    mockPrisma.project.count.mockResolvedValue(0)
    mockPrisma.project.create.mockResolvedValue({
      id: 'proj_test_123',
      title: 'Test Project',
      status: 'QUEUED',
    })
  })

  it('rejects raw Whop dashboard URLs in POST /api/projects with a helpful error', async () => {
    const { POST } = await import('@/app/api/projects/route')
    const req = new Request('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceType: 'url',
        url: 'https://whop.com/clip-farm-official/exp_sKCcnfigfcLoSb/app/',
        framing: 'smart',
        captionStyle: 'hormozi',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Whop campaign pages are not direct video streams')
  })

  it('rejects ContentRewards competitor leaderboard clips (/downloaded-videos/) in POST /api/projects', async () => {
    const { POST } = await import('@/app/api/projects/route')
    const req = new Request('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceType: 'url',
        url: 'https://cdn.contentrewards.com/downloaded-videos/9e74efa8/video.mp4',
        framing: 'smart',
        captionStyle: 'hormozi',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Competitor leaderboard submission clips cannot be used')
  })

  it('accepts raw campaign MP4 / Google Drive / YouTube streams in POST /api/projects', async () => {
    const { POST } = await import('@/app/api/projects/route')
    const req = new Request('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceType: 'url',
        url: 'https://assets.whop.com/campaigns/raw-footage/stream-vod.mp4',
        framing: 'smart',
        captionStyle: 'hormozi',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('proj_test_123')
  })

  it('analyzes direct Whop campaign URL, strips leaderboard topClips, and extracts raw campaign assets', async () => {
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockImplementation(async (targetUrl: string) => {
      if (targetUrl.includes('drive.google.com/embeddedfolderview')) {
        return {
          ok: true,
          status: 200,
          text: async () => `
            <div class="flip-entry" id="entry-1AbCdEfGhIjKlMnOpQrStUv">
              <a href="https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=drivesdk">
                <div class="flip-entry-title">Podcast_Episode_42_Raw.mp4</div>
              </a>
            </div>
          `,
        } as Response
      }
      if (targetUrl.includes('apps.whop.com') || targetUrl.includes('whop.com')) {
        return {
          ok: true,
          status: 200,
          text: async () => `
            <!DOCTYPE html><html><head><title>Content Rewards</title></head>
            <body>
              <div>\"name\":\"Call of Duty BO7 Clipping\",\"payouts\":[{\"maxPayoutCents\":50000,\"rateCents\":50}],\"organizationExperienceId\":\"exp_Q5JcJggb3l7FH7\",\"dos\":[\"Use 9:16 vertical format\",\"Mention @cod in caption\"],\"referenceMaterials\":[\"https://drive.google.com/drive/folders/12345abcdefghijkl\"],\"topClips\":[{\"videoUrl\":\"https://cdn.contentrewards.com/downloaded-videos/9e74efa8/instagram_DcgSHmciF32.mp4\"}]}</div>
              <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Raw Stream VOD</a>
            </body></html>
          `,
        } as Response
      }
      return { ok: false, status: 404, text: async () => '' } as Response
    })

    const { POST } = await import('@/app/api/campaigns/analyze/route')
    const req = new Request('http://localhost:3000/api/campaigns/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://whop.com/contentrewards-ugc/exp_Q5JcJggb3l7FH7/app/campaigns/218d362d-f6ff-4763-8f62-ba6ff0f03d66/',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.campaign.platform).toBe('Whop Campaign')
    expect(data.campaign.primaryAsset).toBeDefined()
    // Must NOT include competitor topClips from /downloaded-videos/
    const allAssetUrls = data.campaign.assets.map((a: any) => a.url)
    expect(allAssetUrls.some((u: string) => u.includes('/downloaded-videos/'))).toBe(false)
    // Must include expanded Google Drive file and YouTube VOD
    expect(allAssetUrls.some((u: string) => u.includes('1AbCdEfGhIjKlMnOpQrStUv'))).toBe(true)
    expect(allAssetUrls.some((u: string) => u.includes('youtube.com/watch?v=dQw4w9WgXcQ'))).toBe(true)

    global.fetch = originalFetch
  })

  it('recognizes a Whop Hub URL without direct video and returns isHub: true with instructions', async () => {
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        text: async () => `
          <!DOCTYPE html><html><head><title>Clip Farm | Whop</title></head>
          <body>
            <div>\"publicCompany\":{\"title\":\"Clip Farm\",\"creatorPitch\":\"#1 Clipping Agency\"}</div>
          </body></html>
        `,
      } as Response
    })

    const { POST } = await import('@/app/api/campaigns/analyze/route')
    const req = new Request('http://localhost:3000/api/campaigns/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://whop.com/clip-farm-official/exp_sKCcnfigfcLoSb/app/',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.campaign.isHub).toBe(true)
    expect(data.campaign.hubMessage).toContain('Clip Farm')
    expect(data.campaign.primaryAsset).toBeNull()

    global.fetch = originalFetch
  })
})

