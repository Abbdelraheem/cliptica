import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

const redis = url && token ? new Redis({ url, token }) : null

function makeLimiter(prefix: string, maxRequests: number, window: `${number} ${'s' | 'm' | 'h'}`) {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    prefix,
  })
}

export const loginIpLimiter = makeLimiter('rl:login-ip', 5, '1 m')
export const loginEmailLimiter = makeLimiter('rl:login-email', 5, '1 m')
export const registerLimiter = makeLimiter('rl:register', 5, '1 m')
export const apiMutationLimiter = makeLimiter('rl:api-mutation', 30, '1 m')

type RequestLike = {
  headers?: Record<string, unknown> | { get(name: string): string | null } | null
}

function readHeader(headers: NonNullable<RequestLike['headers']>, name: string): string | null {
  if (typeof (headers as { get?: unknown }).get === 'function') {
    return (headers as { get(name: string): string | null }).get(name)
  }
  const value = (headers as Record<string, unknown>)[name]
  return typeof value === 'string' ? value : null
}

export function getClientIp(request?: RequestLike): string {
  if (!request?.headers) return 'unknown'
  const forwarded = readHeader(request.headers, 'x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return readHeader(request.headers, 'x-real-ip') ?? 'unknown'
}

type Limiter = Pick<Ratelimit, 'limit'>

export async function enforceRateLimit(
  limiter: Limiter | null,
  identifier: string
): Promise<NextResponse | null> {
  if (!limiter) return null

  const { success, reset } = await limiter.limit(identifier)
  if (success) return null

  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
  return NextResponse.json(
    { error: 'Too many requests. Please slow down.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}

export async function enforceRequestRateLimit(
  limiter: Limiter | null,
  request: Request,
  scope?: string
): Promise<NextResponse | null> {
  return enforceRateLimit(limiter, `${scope ?? ''}:${getClientIp(request)}`)
}
