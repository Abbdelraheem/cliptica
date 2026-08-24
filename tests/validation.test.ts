import { describe, it, expect } from 'vitest'
import {
  registerSchema,
  emailOnlySchema,
  resetPasswordSchema,
  verificationTokenSchema,
  payoutCreateSchema,
  MAX_PAYOUT_AMOUNT,
} from '@/lib/validation'

describe('registerSchema', () => {
  const valid = {
    email: 'creator@nology.com',
    password: 'supersecret1',
    deviceId: 'abcdefgh12345678',
  }

  it('accepts a minimal valid payload', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts an optional name', () => {
    expect(registerSchema.safeParse({ ...valid, name: 'Dr. Clip' }).success).toBe(true)
  })

  it('rejects invalid email', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects short passwords', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false)
  })

  it('rejects short device ids', () => {
    expect(registerSchema.safeParse({ ...valid, deviceId: 'abc' }).success).toBe(false)
  })
})

describe('emailOnlySchema', () => {
  it('accepts valid emails and rejects others', () => {
    expect(emailOnlySchema.safeParse({ email: 'a@b.co' }).success).toBe(true)
    expect(emailOnlySchema.safeParse({ email: 'nope' }).success).toBe(false)
    expect(emailOnlySchema.safeParse({}).success).toBe(false)
  })
})

describe('resetPasswordSchema', () => {
  it('requires a 32+ char token and 8+ char password', () => {
    const token = 'a'.repeat(32)
    expect(resetPasswordSchema.safeParse({ token, password: 'newpassword' }).success).toBe(true)
    expect(resetPasswordSchema.safeParse({ token: 'short', password: 'newpassword' }).success).toBe(false)
    expect(resetPasswordSchema.safeParse({ token, password: 'tiny' }).success).toBe(false)
  })
})

describe('verificationTokenSchema', () => {
  it('mirrors reset token constraints', () => {
    expect(verificationTokenSchema.safeParse({ token: 't'.repeat(64) }).success).toBe(true)
    expect(verificationTokenSchema.safeParse({ token: 'x' }).success).toBe(false)
  })
})

describe('payoutCreateSchema', () => {
  const base = { periodStart: '2026-01-01', periodEnd: '2026-01-31' }

  it('accepts a normal amount', () => {
    expect(payoutCreateSchema.safeParse({ ...base, amount: 250 }).success).toBe(true)
  })

  it('coerces date strings into Date objects', () => {
    const parsed = payoutCreateSchema.safeParse({ ...base, amount: 10 })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.periodStart).toBeInstanceOf(Date)
    }
  })

  it('rejects zero or negative amounts', () => {
    expect(payoutCreateSchema.safeParse({ ...base, amount: 0 }).success).toBe(false)
    expect(payoutCreateSchema.safeParse({ ...base, amount: -50 }).success).toBe(false)
  })

  it(`rejects amounts above the ${MAX_PAYOUT_AMOUNT} ceiling`, () => {
    expect(payoutCreateSchema.safeParse({ ...base, amount: MAX_PAYOUT_AMOUNT }).success).toBe(true)
    expect(
      payoutCreateSchema.safeParse({ ...base, amount: MAX_PAYOUT_AMOUNT + 0.01 }).success
    ).toBe(false)
  })

  it('rejects missing periods', () => {
    expect(payoutCreateSchema.safeParse({ amount: 100 }).success).toBe(false)
  })
})
