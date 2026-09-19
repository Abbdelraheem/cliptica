import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

const redis = url && token ? new Redis({ url, token }) : null

class MemorySlidingWindowLimiter {
  private maxRequests: number
  private windowMs: number
  private hits = new Map<string, number[]>()

  constructor(maxRequests: number, windowStr: string) {
    this.maxRequests = maxRequests
    const num = parseInt(windowStr, 10)
    if (windowStr.endsWith('s')) this.windowMs = num * 1000
    else if (windowStr.endsWith('m')) this.windowMs = num * 60 * 1000
    else if (windowStr.endsWith('h')) this.windowMs = num * 3600 * 1000
    else this.windowMs = 60 * 1000
  }

  async limit(identifier: string): Promise<{
    success: boolean
    reset: number
    remaining: number
    limit: number
    pending: Promise<unknown>
  }> {
    const now = Date.now()
    const windowStart = now - this.windowMs
    let timestamps = this.hits.get(identifier) || []
    timestamps = timestamps.filter((t) => t > windowStart)

    if (timestamps.length >= this.maxRequests) {
      const reset = (timestamps[0] || now) + this.windowMs
      return {
        success: false,
        reset,
        remaining: 0,
        limit: this.maxRequests,
        pending: Promise.resolve(),
      }
    }

    timestamps.push(now)
    this.hits.set(identifier, timestamps)
    return {
      success: true,
      reset: now + this.windowMs,
      remaining: this.maxRequests - timestamps.length,
      limit: this.maxRequests,
      pending: Promise.resolve(),
    }
  }
}

function makeLimiter(prefix: string, maxRequests: number, window: `${number} ${'s' | 'm' | 'h'}`) {
  if (redis) {
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, window),
      prefix,
    })
  }
  return new MemorySlidingWindowLimiter(maxRequests, window)
}

export const loginIpLimiter = makeLimiter('rl:login-ip', 5, '1 m')
export const loginEmailLimiter = makeLimiter('rl:login-email', 5, '1 m')
export const registerLimiter = makeLimiter('rl:register', 5, '1 m')
export const forgotPasswordLimiter = makeLimiter('rl:forgot-password', 3, '1 m')
export const resetPasswordLimiter = makeLimiter('rl:reset-password', 5, '1 m')
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

type Limiter = {
  limit(identifier: string): Promise<{
    success: boolean
    reset: number
    remaining?: number
    limit?: number
    pending?: Promise<unknown>
  }>
}

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
