import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Map([
    ['user-agent', 'Mozilla/5.0 Vitest Test Browser'],
    ['x-forwarded-for', '127.0.0.1'],
  ])),
}))

// Mock auth
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// Mock email
const mockSendEmail = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/email', () => ({
  sendEmail: (opts: any) => mockSendEmail(opts),
  passwordChangedEmailHtml: () => '<p>Password changed</p>',
}))

// Mock prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  apiKey: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  session: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
}
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

describe('Settings Features API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: 'usr_123', email: 'test@example.com' },
    })
  })

  it('change-password: updates hash when current password matches', async () => {
    const { hash } = await import('bcryptjs')
    const currentHash = await hash('OldPassword123!', 10)

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'usr_123',
      email: 'test@example.com',
      passwordHash: currentHash,
    })
    mockPrisma.user.update.mockResolvedValue({ id: 'usr_123' })

    const { POST } = await import('@/app/api/auth/change-password/route')
    const req = new Request('http://localhost/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockPrisma.user.update).toHaveBeenCalled()
    expect(mockSendEmail).toHaveBeenCalled()
  })

  it('change-password: rejects incorrect current password with 400', async () => {
    const { hash } = await import('bcryptjs')
    const currentHash = await hash('CorrectPass123!', 10)

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'usr_123',
      email: 'test@example.com',
      passwordHash: currentHash,
    })

    const { POST } = await import('@/app/api/auth/change-password/route')
    const req = new Request('http://localhost/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Current password is incorrect')
  })

  it('api-keys: creates key and returns plaintext key once', async () => {
    mockPrisma.apiKey.create.mockImplementation(({ data }: any) => Promise.resolve({
      id: 'key_1',
      name: data.name,
      key: data.key,
      createdAt: new Date(),
    }))

    const { POST } = await import('@/app/api/user/api-keys/route')
    const req = new Request('http://localhost/api/user/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Production Bot' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.key.rawKey).toMatch(/^nlg_live_/)
    expect(json.key.name).toBe('Production Bot')
  })

  it('api-keys: masks keys on list endpoint', async () => {
    mockPrisma.apiKey.findMany.mockResolvedValue([
      {
        id: 'key_1',
        name: 'Zapier Integration',
        key: 'nlg_live_1234567890abcdef12345678',
        lastUsed: null,
        createdAt: new Date(),
      },
    ])

    const { GET } = await import('@/app/api/user/api-keys/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.keys[0].maskedKey).toBe('nlg_live...5678')
    expect(json.keys[0].key).toBeUndefined()
  })

  it('notifications: retrieves and updates user preference flags', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      notifyOnComplete: true,
      notifyOnLowCredits: true,
      notifyOnWeeklyDigest: false,
    })
    mockPrisma.user.update.mockResolvedValue({
      notifyOnComplete: false,
      notifyOnLowCredits: true,
      notifyOnWeeklyDigest: true,
    })

    const { GET, PATCH } = await import('@/app/api/user/notifications/route')
    const getRes = await GET()
    expect(getRes.status).toBe(200)
    const getJson = await getRes.json()
    expect(getJson.notifyOnComplete).toBe(true)

    const patchReq = new Request('http://localhost/api/user/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifyOnComplete: false, notifyOnWeeklyDigest: true }),
    })
    const patchRes = await PATCH(patchReq)
    expect(patchRes.status).toBe(200)
    const patchJson = await patchRes.json()
    expect(patchJson.preferences.notifyOnComplete).toBe(false)
    expect(patchJson.preferences.notifyOnWeeklyDigest).toBe(true)
  })
})
