import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import {
  enforceRequestRateLimit,
  forgotPasswordLimiter,
} from '@/lib/rate-limit'
import { generateVerificationToken, sendEmail, verificationEmailHtml } from '@/lib/email'
import { emailOnlySchema } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    const limited = await enforceRequestRateLimit(forgotPasswordLimiter, request, 'resend-verification')
    if (limited) return limited

    const body = await request.json()
    const validated = emailOnlySchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validated.error.flatten() },
        { status: 400 }
      )
    }

    const email = validated.data.email.toLowerCase()
    const user = await prisma.user.findUnique({ where: { email } })

    // Generic response — never confirm whether the account exists or is
    // already verified.
    if (!user || user.emailVerified || !user.passwordHash) {
      return NextResponse.json({ message: 'If that account needs verification, a new link has been sent.' })
    }

    const { token, tokenHash } = generateVerificationToken()

    await prisma.$transaction([
      prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      }),
    ])

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      await sendEmail({
        to: user.email,
        subject: 'Confirm your Cliptica email',
        html: verificationEmailHtml(`${appUrl}/verify-email?token=${token}`),
      })
    } catch (err) {
      console.error('Failed to deliver verification email:', err)
      return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 })
    }

    return NextResponse.json({ message: 'If that account needs verification, a new link has been sent.' })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
