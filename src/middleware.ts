import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Edge-safe session check: presence of the next-auth session cookie.
 * Real verification happens server-side via getServerSession in
 * layouts and API route handlers.
 */
function hasSessionCookie(request: NextRequest): boolean {
  const names = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'authjs.session-token',
    '__Secure-authjs.session-token',
  ]
  return names.some((name) => request.cookies.has(name))
}

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

const loginCallbackLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      prefix: 'rl:login-callback',
    })
    : null

async function rateLimitLoginCallback(request: NextRequest): Promise<NextResponse | null> {
  if (!loginCallbackLimiter) return null

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const { success, reset } = await loginCallbackLimiter.limit(ip)
  if (success) return null

  return new NextResponse(
    JSON.stringify({ error: 'Too many requests. Please slow down.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
      },
    }
  )
}

import { isCrawler, COUNTRY_TO_LOCALE, isValidLocale } from '@/lib/seo/constants'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Handle CORS preflight OPTIONS requests immediately
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://clipzila.com'
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET,DELETE,PATCH,POST,PUT,OPTIONS',
        'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  if (pathname.startsWith('/api/auth/callback')) {
    const limited = await rateLimitLoginCallback(request)
    if (limited) return limited
  }

  const loggedIn = hasSessionCookie(request)

  // Protected routes
  const protectedPaths = [
    '/dashboard',
    '/admin',
    '/api/projects',
    '/api/campaigns',
    '/api/payouts',
    '/api/admin',
    '/api/user',
  ]
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path))

  // Auth routes (redirect to dashboard if already logged in)
  const authPaths = ['/login', '/register']
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path))

  if (isProtected && !loggedIn) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPath && loggedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  return response
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/projects/:path*',
    '/api/campaigns/:path*',
    '/api/payouts/:path*',
    '/api/admin/:path*',
    '/api/user/:path*',
    '/api/auth/callback/:path*',
    '/login',
    '/register',
  ],
}
