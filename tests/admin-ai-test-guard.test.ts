import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getAdminSessionMock } = vi.hoisted(() => ({
  getAdminSessionMock: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getAdminSession: getAdminSessionMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    setting: {
      findUnique: vi.fn(),
    },
  },
}))

import { POST } from '@/app/api/admin/ai-test/route'

describe('Admin AI Test Route Guard', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('rejects unauthenticated requests with 403 Forbidden and makes zero fetch calls', async () => {
    getAdminSessionMock.mockResolvedValue(null)

    const req = new NextRequest('http://localhost:3000/api/admin/ai-test', {
      method: 'POST',
      body: JSON.stringify({ key: 'gsk_test12345', provider: 'groq' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejects regular non-admin user sessions with 403 Forbidden and makes zero fetch calls', async () => {
    getAdminSessionMock.mockResolvedValue(null)

    const req = new NextRequest('http://localhost:3000/api/admin/ai-test', {
      method: 'POST',
      body: JSON.stringify({ key: 'gsk_test12345', provider: 'groq' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
