import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  creditTransaction: {
    create: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

import { authOptions } from '@/lib/auth'

describe('NextAuth Name Persistence & Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('jwt callback: populates token.name from database user on initial sign-in', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'usr_abc',
      role: 'FREE',
      credits: 50,
      name: 'Dr. Abdelraheem',
    })

    const jwtCallback = authOptions.callbacks?.jwt
    expect(jwtCallback).toBeDefined()

    const token = await jwtCallback!({
      token: {},
      user: { id: 'usr_abc', email: 'user@cliptica.com', name: 'Old Fallback' },
      account: null,
    })

    expect(token.id).toBe('usr_abc')
    expect(token.name).toBe('Dr. Abdelraheem')
    expect(token.credits).toBe(50)
    expect(token.role).toBe('FREE')
  })

  it('jwt callback: updates token.name on trigger === "update"', async () => {
    const jwtCallback = authOptions.callbacks?.jwt
    expect(jwtCallback).toBeDefined()

    const initialToken = {
      id: 'usr_abc',
      name: 'Old Name',
      role: 'FREE',
      credits: 50,
    }

    const updatedToken = await jwtCallback!({
      token: initialToken,
      trigger: 'update',
      session: { name: 'Updated Name', credits: 45 },
    })

    expect(updatedToken.name).toBe('Updated Name')
    expect(updatedToken.credits).toBe(45)
    expect(updatedToken.role).toBe('FREE')
  })

  it('session callback: passes token.name to session.user.name', async () => {
    const sessionCallback = authOptions.callbacks?.session
    expect(sessionCallback).toBeDefined()

    const sessionObj = {
      user: { id: '', email: 'user@cliptica.com' },
      expires: '2026-12-31',
    }
    const tokenObj = {
      id: 'usr_abc',
      name: 'Verified Display Name',
      role: 'STUDIO',
      credits: 1200,
    }

    const resSession = await sessionCallback!({
      session: sessionObj as any,
      token: tokenObj as any,
    })

    expect(resSession.user.name).toBe('Verified Display Name')
    expect((resSession.user as any).role).toBe('STUDIO')
    expect((resSession.user as any).credits).toBe(1200)
  })
})
