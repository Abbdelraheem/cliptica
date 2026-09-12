import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hash, compare } from 'bcryptjs'

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'usr_pwd_test', email: 'tester@cliptica.com' } }),
}))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  passwordChangedEmailHtml: vi.fn().mockReturnValue('<p>Password changed</p>'),
}))

describe('Password Change & Verification Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifies that new password hash replaces old hash and old password can no longer authenticate', async () => {
    const oldPassword = 'OldSecurePassword123!'
    const newPassword = 'NewSecurePassword456!'
    const initialHash = await hash(oldPassword, 10)

    let storedHash = initialHash

    mockPrisma.user.findUnique.mockImplementation(() =>
      Promise.resolve({
        id: 'usr_pwd_test',
        email: 'tester@cliptica.com',
        passwordHash: storedHash,
      })
    )

    mockPrisma.user.update.mockImplementation(({ data }: { data: { passwordHash: string } }) => {
      storedHash = data.passwordHash
      return Promise.resolve({ id: 'usr_pwd_test', passwordHash: storedHash })
    })

    // 1. Verify old password matches initial hash
    expect(await compare(oldPassword, storedHash)).toBe(true)

    // 2. Perform password change via API route
    const { POST } = await import('@/app/api/auth/change-password/route')
    const req = new Request('http://localhost/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: oldPassword,
        newPassword,
        confirmPassword: newPassword,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)

    // 3. Verify old password now FAILS
    const oldPasswordMatches = await compare(oldPassword, storedHash)
    expect(oldPasswordMatches).toBe(false)

    // 4. Verify new password now SUCCEEDS
    const newPasswordMatches = await compare(newPassword, storedHash)
    expect(newPasswordMatches).toBe(true)
  }, 15000)
})
