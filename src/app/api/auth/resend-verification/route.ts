import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import {
  enforceRequestRateLimit,
  forgotPasswordLimiter,
} from '@/lib/rate-limit'
import { generateVerificationToken, sendEmail } from '@/lib/email'
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
        subject: 'Confirm your NOLOGY email',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#f5f2ea;background:#101010;border-radius:16px">
            <p style="letter-spacing:0.3em;font-size:12px;color:#d4af37">NOLOGY</p>
            <h1 style="font-size:22px;margin:16px 0">Verify your email</h1>
            <p style="color:#b8b4a8;line-height:1.6">Here's a fresh confirmation link for your account.</p>
            <p style="margin:28px 0">
              <a href="${appUrl}/verify-email?token=${token}" style="background:#d4af37;color:#101010;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold">Verify my email</a>
            </p>
            <p style="color:#6b675c;font-size:13px">This link expires in 24 hours.</p>
          </div>
        `.trim(),
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
