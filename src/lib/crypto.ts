import crypto from 'crypto'

/**
 * Derives a 32-byte key suitable for AES-256-GCM from the provided secret
 * or environment variables (ENCRYPTION_SECRET, NEXTAUTH_SECRET).
 */
export function getEncryptionKey(overrideSecret?: string): Buffer {
  const secret =
    overrideSecret ||
    process.env.ENCRYPTION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'cliptica-dev-stable-encryption-seed-2026'
  return crypto.createHash('sha256').update(secret).digest()
}

/**
 * Encrypts sensitive string data (such as OAuth access & refresh tokens)
 * using AES-256-GCM with a fresh 12-byte random IV.
 * Stored format: `ivHex:authTagHex:cipherHex`
 */
export function encryptToken(plaintext: string, overrideSecret?: string): string {
  if (!plaintext) return ''
  const key = getEncryptionKey(overrideSecret)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

/**
 * Decrypts an AES-256-GCM ciphertext created by encryptToken.
 * Throws an error if the key is incorrect or data was tampered with.
 */
export function decryptToken(ciphertext: string, overrideSecret?: string): string {
  if (!ciphertext) return ''
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted token format: expected iv:tag:ciphertext')
  }

  const [ivHex, tagHex, encryptedHex] = parts
  const key = getEncryptionKey(overrideSecret)
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export interface OAuthStatePayload {
  userId: string
  platform: 'TIKTOK' | 'YOUTUBE' | 'INSTAGRAM'
  returnUrl?: string
  ts?: number
  [key: string]: unknown
}

/**
 * Signs an OAuth state payload using HMAC-SHA256 with timestamp verification.
 * Resistant to CSRF, forgery, and replay attacks.
 */
export function signOAuthState(payload: OAuthStatePayload, overrideSecret?: string): string {
  const secret = overrideSecret || process.env.NEXTAUTH_SECRET || 'cliptica-oauth-state-secret'
  const data = {
    ...payload,
    ts: typeof payload.ts === 'number' ? payload.ts : Date.now(),
  }
  const serialized = Buffer.from(JSON.stringify(data)).toString('base64url')
  const hmac = crypto.createHmac('sha256', secret).update(serialized).digest('base64url')
  return `${serialized}.${hmac}`
}

/**
 * Verifies and parses an OAuth state token. Returns null if forged, corrupted, or expired.
 */
export function verifyOAuthState<T extends OAuthStatePayload = OAuthStatePayload>(
  stateStr: string,
  maxAgeMs = 15 * 60 * 1000, // 15 minutes default
  overrideSecret?: string
): T | null {
  if (!stateStr || typeof stateStr !== 'string') return null
  const [serialized, signature] = stateStr.split('.')
  if (!serialized || !signature) return null

  const secret = overrideSecret || process.env.NEXTAUTH_SECRET || 'cliptica-oauth-state-secret'
  const expectedSig = crypto.createHmac('sha256', secret).update(serialized).digest('base64url')

  // Timing-safe comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null
  }

  try {
    const raw = Buffer.from(serialized, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw) as T
    if (!parsed.ts || typeof parsed.ts !== 'number') return null
    if (Date.now() - parsed.ts > maxAgeMs) {
      // Expired state
      return null
    }
    return parsed
  } catch {
    return null
  }
}
