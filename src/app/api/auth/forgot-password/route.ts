import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  enforceRequestRateLimit,
  forgotPasswordLimiter,
} from '@/lib/rate-limit'
import {
  generateResetToken,
  passwordResetEmailHtml,
  sendEmail,
} from '@/lib/email'

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: Request) {
  try {
    const limited = await enforceRequestRateLimit(forgotPasswordLimiter, request, 'forgot-password')
    if (limited) return limited

    const body = await request.json()
    const validated = forgotPasswordSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validated.error.flatten() },
        { status: 400 }
      )
    }

    const email = validated.data.email.toLowerCase()
    const user = await prisma.user.findUnique({ where: { email } })

    // Always answer the same way so the endpoint can't be used to
    // enumerate registered accounts.
    if (!user || !user.passwordHash) {
      return NextResponse.json({ message: 'If that account exists, a reset link has been sent.' })
    }

    const { token, tokenHash } = generateResetToken()

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      }),
    ])

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const link = `${appUrl}/reset-password?token=${token}`

    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset your NOLOGY password',
        html: passwordResetEmailHtml(link),
      })
    } catch (err) {
      console.error('Failed to deliver password reset email:', err)
      return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 })
    }

    return NextResponse.json({ message: 'If that account exists, a reset link has been sent.' })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
