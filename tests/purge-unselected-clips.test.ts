import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  project: {
    findFirst: vi.fn(),
  },
  clip: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
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
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' })

    const req = new Request('http://localhost/api/projects/p1/clips/purge-unselected', {
      method: 'POST',
      body: JSON.stringify({ keepClipIds: [] }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(400)
  })

  it('deletes only the unselected clips when some are chosen', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' })
    mockPrisma.clip.findMany.mockResolvedValue([
      { id: 'c1' },
      { id: 'c2' },
      { id: 'c3' },
    ])
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

    expect(mockPrisma.clip.deleteMany).toHaveBeenCalledWith({
      where: {
        projectId: 'p1',
        id: { in: ['c1', 'c3'] },
      },
    })
  })

  it('handles keeping all clips without triggering delete', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' })
    mockPrisma.clip.findMany.mockResolvedValue([
      { id: 'c1' },
      { id: 'c2' },
    ])

    const req = new Request('http://localhost/api/projects/p1/clips/purge-unselected', {
      method: 'POST',
      body: JSON.stringify({ keepClipIds: ['c1', 'c2'] }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.deleted).toBe(0)
    expect(mockPrisma.clip.deleteMany).not.toHaveBeenCalled()
  })
})
