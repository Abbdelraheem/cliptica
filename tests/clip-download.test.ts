import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  project: {
    findFirst: vi.fn(),
  },
  clip: {
    findFirst: vi.fn(),
  },
  processingJob: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}))

const mockAuth = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

vi.mock('@/lib/r2', () => ({
  r2PresignGet: vi.fn((key: string) => `https://signed.r2.cloudflarestorage.com/${key}?sig=test`),
}))

import { GET } from '@/app/api/projects/[id]/clips/[clipId]/download/route'

describe('GET /api/projects/[id]/clips/[clipId]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('rejects unauthenticated requests with 401', async () => {
    mockAuth.mockResolvedValue(null)
    const req = new Request('http://localhost/api/projects/p1/clips/c1/download')
    const res = await GET(req, { params: Promise.resolve({ id: 'p1', clipId: 'c1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 if project not owned by user', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null)
    const req = new Request('http://localhost/api/projects/p1/clips/c1/download')
    const res = await GET(req, { params: Promise.resolve({ id: 'p1', clipId: 'c1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 404 if clip not found', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' })
    mockPrisma.clip.findFirst.mockResolvedValue(null)
    const req = new Request('http://localhost/api/projects/p1/clips/c1/download')
    const res = await GET(req, { params: Promise.resolve({ id: 'p1', clipId: 'c1' }) })
    expect(res.status).toBe(404)
  })

  it('returns ready: true immediately when exportUrl is already rendered', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' })
    mockPrisma.clip.findFirst.mockResolvedValue({
      id: 'c1',
      title: 'Viral Hook',
      videoUrl: 'https://r2.cloudflarestorage.com/bucket/u1/p1/clip-1.mp4',
      exportUrl: 'https://r2.cloudflarestorage.com/bucket/u1/p1/clip-c1-hd.mp4',
      exportedAt: new Date(),
    })

    const req = new Request('http://localhost/api/projects/p1/clips/c1/download')
    const res = await GET(req, { params: Promise.resolve({ id: 'p1', clipId: 'c1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ready).toBe(true)
    expect(json.downloadUrl).toContain('clip-c1-hd.mp4')
  })

  it('dispatches clip_render_hd job when exportUrl is null and no active job exists', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' })
    mockPrisma.clip.findFirst.mockResolvedValue({
      id: 'c1',
      title: 'Viral Hook',
      videoUrl: 'https://r2.cloudflarestorage.com/bucket/u1/p1/clip-1.mp4',
      exportUrl: null,
      exportedAt: null,
    })
    mockPrisma.processingJob.findFirst.mockResolvedValue(null)
    mockPrisma.processingJob.create.mockResolvedValue({
      id: 'job-hd-1',
      projectId: 'p1',
      type: 'clip_render_hd',
      status: 'queued',
      progress: 0,
    })

    const req = new Request('http://localhost/api/projects/p1/clips/c1/download')
    const res = await GET(req, { params: Promise.resolve({ id: 'p1', clipId: 'c1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ready).toBe(false)
    expect(json.status).toBe('queued')
    expect(json.jobId).toBe('job-hd-1')
    expect(mockPrisma.processingJob.create).toHaveBeenCalledWith({
      data: {
        projectId: 'p1',
        type: 'clip_render_hd',
        status: 'queued',
        progress: 0,
        result: { clipId: 'c1' },
      },
    })
  })

  it('reuses active clip_render_hd job without creating duplicate', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' })
    mockPrisma.clip.findFirst.mockResolvedValue({
      id: 'c1',
      title: 'Viral Hook',
      videoUrl: 'https://r2.cloudflarestorage.com/bucket/u1/p1/clip-1.mp4',
      exportUrl: null,
    })
    mockPrisma.processingJob.findFirst.mockResolvedValue({
      id: 'job-existing',
      status: 'processing',
      progress: 60,
      result: { clipId: 'c1' },
    })

    const req = new Request('http://localhost/api/projects/p1/clips/c1/download')
    const res = await GET(req, { params: Promise.resolve({ id: 'p1', clipId: 'c1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ready).toBe(false)
    expect(json.status).toBe('processing')
    expect(json.progress).toBe(60)
    expect(mockPrisma.processingJob.create).not.toHaveBeenCalled()
  })
})
