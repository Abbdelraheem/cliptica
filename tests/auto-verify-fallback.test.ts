import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  emailVerificationToken: {
    create: vi.fn(),
  },
  creditTransaction: {
    create: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/rate-limit', () => ({
  loginEmailLimiter: null,
  registerLimiter: null,
  enforceRequestRateLimit: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/device', () => ({
  assertDeviceAvailable: vi.fn().mockResolvedValue(undefined),
  bindDevice: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('bcryptjs', () => ({
  compare: vi.fn().mockResolvedValue(true),
  hash: vi.fn().mockResolvedValue('hashed_pwd_123'),
}))

describe('Auto-Verification Fallback when Resend is Unset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.RESEND_API_KEY
  })

  it('verification-status: returns needsVerification: false when RESEND_API_KEY is not set', async () => {
    const { POST } = await import('@/app/api/auth/verification-status/route')
    const req = new Request('http://localhost/api/auth/verification-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'creator@example.com', password: 'ValidPassword123!' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.needsVerification).toBe(false)
  })

  it('register route: auto-verifies user and sets emailVerified to Date when RESEND_API_KEY is unset', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null) // no existing user
    mockPrisma.user.create.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: 'usr_new_123',
        ...data,
      })
    )
    mockPrisma.creditTransaction.create.mockResolvedValue({})

    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Creator',
        email: 'newcreator@example.com',
        password: 'ValidPassword123!',
        deviceId: 'dev_test_123',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.autoVerified).toBe(true)
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailVerified: expect.any(Date),
        }),
      })
    )
    // Verification token is NOT created when Resend is unset
    expect(mockPrisma.emailVerificationToken.create).not.toHaveBeenCalled()
  })

  it('register route: auto-verifies user even when RESEND_API_KEY is present if REQUIRE_EMAIL_VERIFICATION is not true', async () => {
    process.env.RESEND_API_KEY = 're_test_key_123'
    delete process.env.REQUIRE_EMAIL_VERIFICATION

    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.create.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: 'usr_new_456',
        ...data,
      })
    )
    mockPrisma.creditTransaction.create.mockResolvedValue({})

    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Auto Verified Creator',
        email: 'autoverify@example.com',
        password: 'ValidPassword123!',
        deviceId: 'dev_test_456',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.autoVerified).toBe(true)
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailVerified: expect.any(Date),
        }),
      })
    )
    expect(mockPrisma.emailVerificationToken.create).not.toHaveBeenCalled()
  })
})
