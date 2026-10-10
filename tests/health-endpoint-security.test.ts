import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQueryRaw = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}))

import { GET } from '@/app/api/health/route'

describe('Health Check Endpoint Security (Phase 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with exactly { status, timestamp } keys when DB is healthy', async () => {
    mockQueryRaw.mockResolvedValue([{ 1: 1 }])

    const res = await GET()
    expect(res.status).toBe(200)
    const json = (await res.json()) as Record<string, unknown>

    expect(Object.keys(json).sort()).toEqual(['status', 'timestamp'])
    expect(json.status).toBe('healthy')
    expect(typeof json.timestamp).toBe('string')
    // Verify no system info leaked
    expect(json.system).toBeUndefined()
    expect(json.pid).toBeUndefined()
    expect(json.node_version).toBeUndefined()
    expect(json.checks).toBeUndefined()
  })

  it('returns 503 with exactly { status, timestamp } keys when DB fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('Connection refused'))

    const res = await GET()
    expect(res.status).toBe(503)
    const json = (await res.json()) as Record<string, unknown>

    expect(Object.keys(json).sort()).toEqual(['status', 'timestamp'])
    expect(json.status).toBe('degraded')
    expect(typeof json.timestamp).toBe('string')
    expect(json.system).toBeUndefined()
  })
})
