import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const loggedIn = hasSessionCookie(request)

  // Protected routes
  const protectedPaths = ['/dashboard', '/api/projects', '/api/campaigns', '/api/payouts']
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path))

  // Auth routes (redirect to dashboard if already logged in)
  const authPaths = ['/login', '/register']
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path))

  if (isProtected && !loggedIn) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPath && loggedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/projects/:path*',
    '/api/campaigns/:path*',
    '/api/payouts/:path*',
    '/login',
    '/register',
  ],
}
