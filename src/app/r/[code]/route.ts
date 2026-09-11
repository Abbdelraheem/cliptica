import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const cleanCode = (code || '').trim().toLowerCase()

    if (!cleanCode) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { code: cleanCode },
    })

    if (!affiliate || !affiliate.isActive) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // IP hash for unique visitor tracking without storing raw PII
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
    const userAgent = request.headers.get('user-agent')?.slice(0, 255) || null
    const referer = request.headers.get('referer')?.slice(0, 500) || null

    // Record click asynchronously (don't block redirect)
    prisma.referralClick
      .create({
        data: {
          affiliateId: affiliate.id,
          ipHash,
          userAgent,
          referer,
          landingPage: `/r/${cleanCode}`,
        },
      })
      .catch((err) => console.error('[referral] click record error:', err))

    // Set 30-day attribution cookie and redirect to register page
    const destination = new URL('/register', request.url)
    destination.searchParams.set('ref', cleanCode)

    const response = NextResponse.redirect(destination)
    response.cookies.set('cliptica_ref', cleanCode, {
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      httpOnly: false, // accessible to client scripts if needed
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

    return response
  } catch (error) {
    console.error('[referral] redirect error:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
}
