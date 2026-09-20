import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  project: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  clip: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  creditTransaction: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}))

const mockAuth = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

import { POST } from '@/app/api/projects/[id]/clips/purge-unselected/route'

describe('POST /api/projects/[id]/clips/purge-unselected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default $transaction execution: execute callback passing mockPrisma
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => {
      return cb(mockPrisma)
    })
  })

  it('rejects unauthorized requests with 401', async () => {
    mockAuth.mockResolvedValue(null)
    const req = new Request('http://localhost/api/projects/p1/clips/purge-unselected', {
      method: 'POST',
      body: JSON.stringify({ keepClipIds: ['c1'] }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(401)
  })

  it('rejects when project does not belong to user with 404', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.project.findFirst.mockResolvedValue(null)

    const req = new Request('http://localhost/api/projects/p1/clips/purge-unselected', {
      method: 'POST',
      body: JSON.stringify({ keepClipIds: ['c1'] }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(404)
  })

  it('rejects empty keepClipIds payload with 400', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1', title: 'Test Project', creditsUsed: 1 })

    const req = new Request('http://localhost/api/projects/p1/clips/purge-unselected', {
      method: 'POST',
      body: JSON.stringify({ keepClipIds: [] }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(400)
  })

  it('keeps 1 final video with 0 additional credit deduction (already covered by initial credit)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1', title: 'Test Video', creditsUsed: 1 })
    mockPrisma.clip.findMany.mockResolvedValue([
      { id: 'c1' },
      { id: 'c2' },
      { id: 'c3' },
    ])
    mockPrisma.user.findUnique.mockResolvedValue({ credits: 10 })
    mockPrisma.clip.deleteMany.mockResolvedValue({ count: 2 })

    const req = new Request('http://localhost/api/projects/p1/clips/purge-unselected', {
      method: 'POST',
      body: JSON.stringify({ keepClipIds: ['c2'] }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.kept).toBe(1)
    expect(data.deleted).toBe(2)
    expect(data.creditsDeducted).toBe(0)
    expect(data.totalCreditsUsed).toBe(1)

    // User credits should not be decremented since 1 credit was already reserved
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
    expect(mockPrisma.clip.deleteMany).toHaveBeenCalledWith({
      where: {
        projectId: 'p1',
        id: { in: ['c1', 'c3'] },
      },
    })
  })

  it('charges 1 credit per chosen final video when keeping multiple clips (N videos = N credits)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1', title: 'Big Batch', creditsUsed: 1 })
    mockPrisma.clip.findMany.mockResolvedValue([
      { id: 'c1' },
      { id: 'c2' },
      { id: 'c3' },
    ])
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ credits: 5 }) // initial balance check
      .mockResolvedValueOnce({ credits: 3 }) // post-update balance
    mockPrisma.clip.deleteMany.mockResolvedValue({ count: 0 })

    // User chooses to keep all 3 final videos -> should cost 3 credits total (2 additional credits deducted)
    const req = new Request('http://localhost/api/projects/p1/clips/purge-unselected', {
      method: 'POST',
      body: JSON.stringify({ keepClipIds: ['c1', 'c2', 'c3'] }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.kept).toBe(3)
    expect(data.creditsDeducted).toBe(2)
    expect(data.totalCreditsUsed).toBe(3)

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { credits: { decrement: 2 } },
    })
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        amount: -2,
        type: 'usage',
      }),
    })
    expect(mockPrisma.project.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { creditsUsed: 3 },
    })
  })

  it('rejects with 402 if user has insufficient credits for keeping multiple final videos', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1', title: 'Low Balance', creditsUsed: 1 })
    mockPrisma.clip.findMany.mockResolvedValue([
      { id: 'c1' },
      { id: 'c2' },
      { id: 'c3' },
    ])
    mockPrisma.user.findUnique.mockResolvedValue({ credits: 0 }) // 0 credits, but needs 2 to keep 3 videos

    const req = new Request('http://localhost/api/projects/p1/clips/purge-unselected', {
      method: 'POST',
      body: JSON.stringify({ keepClipIds: ['c1', 'c2', 'c3'] }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(402)
    const data = await res.json()
    expect(data.error).toMatch(/Insufficient credits/)
    expect(mockPrisma.clip.deleteMany).not.toHaveBeenCalled()
  })
})
