import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { hashToken } from '@/lib/email'
import { verificationTokenSchema } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = verificationTokenSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(validated.data.token) },
    })

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired verification link' }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: new Date() },
      }),
      prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ])

    await prisma.emailVerificationToken.deleteMany({
      where: { userId: record.userId, usedAt: null },
    })

    return NextResponse.json({ message: 'Email verified. You can now log in.' })
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
