import { describe, it, expect } from 'vitest'
import {
  registerSchema,
  emailOnlySchema,
  resetPasswordSchema,
  verificationTokenSchema,
  payoutCreateSchema,
  MAX_PAYOUT_AMOUNT,
  cleanUrlString,
  normaliseVideoUrl,
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

describe('cleanUrlString & normaliseVideoUrl', () => {
  it('strips hidden unicode direction marks (LRM/RLM) and zero-width spaces', () => {
    const dirty = '\u200Ehttps://www.youtube.com/watch?v=dQw4w9WgXcQ\u200F\u200B  '
    expect(cleanUrlString(dirty)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(normaliseVideoUrl(dirty)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('normalises bare shortlinks and domains without protocol', () => {
    expect(normaliseVideoUrl('youtu.be/dQw4w9WgXcQ')).toBe('https://youtu.be/dQw4w9WgXcQ')
    expect(normaliseVideoUrl('youtube.com/shorts/3fQ5pP2Vw4Q')).toBe('https://youtube.com/shorts/3fQ5pP2Vw4Q')
    expect(normaliseVideoUrl('www.youtube.com/watch?v=123')).toBe('https://www.youtube.com/watch?v=123')
  })

  it('accepts complex query params with timestamps, tracking, and encoded Arabic text', () => {
    const urlWithParams = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s&si=abc_123-xyz&feature=share'
    expect(normaliseVideoUrl(urlWithParams)).toBe(urlWithParams)

    const urlWithArabic = 'https://www.youtube.com/results?search_query=%D9%81%D9%8A%D8%AF%D9%8A%D9%88'
    expect(normaliseVideoUrl(urlWithArabic)).toBe(urlWithArabic)
  })

  it('rejects invalid or unsafe non-http protocols', () => {
    expect(normaliseVideoUrl('ftp://example.com/video.mp4')).toBe(null)
    expect(normaliseVideoUrl('javascript:alert(1)')).toBe(null)
    expect(normaliseVideoUrl('file:///etc/passwd')).toBe(null)
  })

  it('rejects empty or hostname-less strings', () => {
    expect(normaliseVideoUrl('')).toBe(null)
    expect(normaliseVideoUrl('   ')).toBe(null)
    expect(normaliseVideoUrl('not-a-domain')).toBe(null)
  })
})
