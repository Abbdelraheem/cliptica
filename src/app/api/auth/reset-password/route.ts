import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import {
  enforceRequestRateLimit,
  resetPasswordLimiter,
} from '@/lib/rate-limit'
import { hashToken } from '@/lib/email'
import { resetPasswordSchema } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    const limited = await enforceRequestRateLimit(resetPasswordLimiter, request, 'reset-password')
    if (limited) return limited

    const body = await request.json()
    const validated = resetPasswordSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validated.error.flatten() },
        { status: 400 }
      )
    }

    const { token, password } = validated.data
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    })

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
    }

    const passwordHash = await hash(password, 12)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ])

    // Invalidate any other outstanding links for this account.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: resetRecord.userId, usedAt: null },
    })

    return NextResponse.json({ message: 'Password updated. You can now log in.' })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
