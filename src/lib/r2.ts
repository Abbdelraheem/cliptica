import { createHash, createHmac } from 'crypto'

/**
 * Minimal AWS SigV4 presigned-URL generator for Cloudflare R2.
 * Zero dependencies — works even on flaky networks (no SDK download).
 */

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest()
const sha256hex = (data: string) => createHash('sha256').update(data).digest('hex')

/**
 * Build a SigV4 presigned URL for an R2 object (GET or PUT).
 * Zero dependencies — used both for uploads (PUT) and clip playback (GET),
 * because the raw R2 storage endpoint is NOT publicly readable.
 */
export function r2Presign(
  key: string,
  method: 'GET' | 'PUT',
  opts: { contentType?: string; expiresInSec?: number } = {}
): string {
  const accountId = process.env.R2_ACCOUNT_ID!
  if (!accountId || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 env vars missing')
  }
  const host = `${accountId}.r2.cloudflarestorage.com`
  const bucket = process.env.R2_BUCKET ?? 'nology-clips'
  const region = 'auto'
  const service = 's3'
  const expiresInSec = opts.expiresInSec ?? 900

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`

  const signedHeaders = method === 'PUT' ? 'host' : 'host'

  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${process.env.R2_ACCESS_KEY_ID}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresInSec),
    'X-Amz-SignedHeaders': signedHeaders,
  })

  const payloadHash = method === 'PUT' ? 'UNSIGNED-PAYLOAD' : sha256hex('')

  const canonicalUri = `/${bucket}/${key.split('/').map(enc).join('/')}`
  const canonicalQueryString = [...query.entries()]
    .map(([k, v]) => [enc(k), enc(v)])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  let canonicalHeaders = `host:${host}\n`
  if (method === 'PUT' && opts.contentType) {
    canonicalHeaders = `content-type:${opts.contentType}\nhost:${host}\n`
    query.set('x-amz-content-sha256', 'UNSIGNED-PAYLOAD')
  }

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash === 'UNSIGNED-PAYLOAD' ? 'UNSIGNED-PAYLOAD' : payloadHash,
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256hex(canonicalRequest),
  ].join('\n')

  const signingKey = hmac(hmac(hmac(hmac(`AWS4${process.env.R2_SECRET_ACCESS_KEY}`, dateStamp), region), service), 'aws4_request')
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`
}

export function r2PresignPut(
  key: string,
  contentType: string,
  expiresInSec = 900
): string {
  return r2Presign(key, 'PUT', { contentType, expiresInSec })
}

/** Presigned GET for clip playback / thumbnails — long expiry so a playing video doesn't cut out. */
export function r2PresignGet(key: string, expiresInSec = 7200): string {
  return r2Presign(key, 'GET', { expiresInSec })
}
