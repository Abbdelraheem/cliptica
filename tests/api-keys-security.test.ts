import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAuth, mockApiKeyCreate, mockApiKeyFindMany } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockApiKeyCreate: vi.fn(),
  mockApiKeyFindMany: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    apiKey: {
      create: mockApiKeyCreate,
      findMany: mockApiKeyFindMany,
    },
  },
}))

import { POST, GET } from '@/app/api/user/api-keys/route'

describe('API Keys Storage Security (Phase 9)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: 'u_key_user' },
    })
  })

  it('stores hashed key in DB and returns rawKey only once in create response', async () => {
    mockApiKeyCreate.mockImplementation(async ({ data }) => ({
      id: 'key_123',
      name: data.name,
      key: data.key,
      createdAt: new Date(),
    }))

    const req = new Request('http://localhost:3000/api/user/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Production Agent' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()

    expect(json.key.rawKey).toMatch(/^nlg_live_[a-f0-9]{48}$/)
    expect(mockApiKeyCreate).toHaveBeenCalledTimes(1)

    const storedData = mockApiKeyCreate.mock.calls[0][0].data
    // Stored key must be a 64-character sha256 hex hash, NOT the rawKey
    expect(storedData.key).not.toBe(json.key.rawKey)
    expect(storedData.key).toMatch(/^[a-f0-9]{64}$/)
  })

  it('list endpoint never returns the raw key or stored key hash', async () => {
    mockApiKeyFindMany.mockResolvedValue([
      {
        id: 'key_123',
        name: 'Production Agent',
        lastUsed: null,
        createdAt: new Date(),
      },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.keys).toHaveLength(1)
    const returnedKey = json.keys[0]
    expect(returnedKey.rawKey).toBeUndefined()
    expect(returnedKey.key).toBeUndefined()
    expect(returnedKey.maskedKey).toBe('nlg_live_••••')
  })
})
