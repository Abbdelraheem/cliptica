import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const userSession = await auth()
    if (!userSession?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const headerList = await headers()
    const userAgent = headerList.get('user-agent') || 'Unknown browser'
    const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || headerList.get('x-real-ip') || '127.0.0.1'

    // Clean up expired sessions first
    await prisma.session.deleteMany({
      where: {
        expires: { lt: new Date() },
      },
    }).catch(() => {})

    let sessions = await prisma.session.findMany({
      where: { userId: userSession.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sessionToken: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expires: true,
      },
    })

    // If no active DB session exists for this user yet, create one for this current login
    if (!sessions.length) {
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      const sessionToken = `sess_${crypto.randomUUID().replace(/-/g, '')}`
      const newSession = await prisma.session.create({
        data: {
          userId: userSession.user.id,
          sessionToken,
          userAgent,
          ipAddress: ip,
          expires,
        },
      })
      sessions = [newSession]
    }

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('List sessions error:', error)
    return NextResponse.json({ error: 'Failed to fetch active sessions' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const userSession = await auth()
    if (!userSession?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Revoke all sessions for this user (sign out everywhere)
    await prisma.session.deleteMany({
      where: { userId: userSession.user.id },
    })

    return NextResponse.json({ success: true, message: 'All sessions revoked' })
  } catch (error) {
    console.error('Revoke all sessions error:', error)
    return NextResponse.json({ error: 'Failed to revoke sessions' }, { status: 500 })
  }
}
