import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getEncryptionKey, encryptToken, decryptToken, signOAuthState, verifyOAuthState } from '@/lib/crypto'

describe('Crypto Secret Production Guard', () => {
  const origNodeEnv = process.env.NODE_ENV
  const origEncryptionSecret = process.env.ENCRYPTION_SECRET
  const origNextAuthSecret = process.env.NEXTAUTH_SECRET

  beforeEach(() => {
    delete process.env.ENCRYPTION_SECRET
    delete process.env.NEXTAUTH_SECRET
  })

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv
    if (origEncryptionSecret !== undefined) {
      process.env.ENCRYPTION_SECRET = origEncryptionSecret
    } else {
      delete process.env.ENCRYPTION_SECRET
    }
    if (origNextAuthSecret !== undefined) {
      process.env.NEXTAUTH_SECRET = origNextAuthSecret
    } else {
      delete process.env.NEXTAUTH_SECRET
    }
  })

  it('throws in production when encryption secrets are missing', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.ENCRYPTION_SECRET
    delete process.env.NEXTAUTH_SECRET

    expect(() => getEncryptionKey()).toThrow(/required in production/)
    expect(() => signOAuthState({ userId: 'u1', platform: 'TIKTOK' })).toThrow(/required in production/)
  })

  it('encrypts and decrypts successfully in a round-trip when secret is provided', () => {
    process.env.NODE_ENV = 'production'
    process.env.ENCRYPTION_SECRET = 'super-secret-prod-key-for-test-32chars!!'

    const message = 'secret-token-123456789'
    const encrypted = encryptToken(message)
    expect(encrypted).not.toBe(message)
    expect(encrypted.split(':')).toHaveLength(3)

    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(message)
  })

  it('signs and verifies OAuth state in non-production with dev fallback', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.NEXTAUTH_SECRET

    const payload = { userId: 'u_test', platform: 'TIKTOK' as const }
    const state = signOAuthState(payload)
    expect(typeof state).toBe('string')

    const verified = verifyOAuthState(state)
    expect(verified?.userId).toBe('u_test')
    expect(verified?.platform).toBe('TIKTOK')
  })
})
