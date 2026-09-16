import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { assertDeviceAvailable, bindDevice, DeviceConflictError } from '@/lib/device'
import { enforceRequestRateLimit, registerLimiter } from '@/lib/rate-limit'
import { generateVerificationToken, sendEmail, verificationEmailHtml } from '@/lib/email'
import { registerSchema } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    const limited = await enforceRequestRateLimit(registerLimiter, request, 'register')
    if (limited) return limited

    const body = await request.json()
    const validated = registerSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validated.error.flatten() },
        { status: 400 }
      )
    }

    const { email, password, name, deviceId, ref } = validated.data
    const userAgent = request.headers.get('user-agent')

    // Check for referral attribution via body param or cookie
    const cookieHeader = request.headers.get('cookie') || ''
    const cookieMatch = /(?:clipzila_ref|cliptica_ref)=([a-zA-Z0-9_-]+)/.exec(cookieHeader)
    const referralCode = (ref || cookieMatch?.[1] || '').trim().toLowerCase()

    let affiliateId: string | null = null
    let affiliateOwnerUserId: string | null = null
    if (referralCode) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { code: referralCode },
        select: { id: true, isActive: true, userId: true },
      })
      if (affiliate?.isActive) {
        affiliateId = affiliate.id
        affiliateOwnerUserId = affiliate.userId
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // One account per device — hard block before anything is created.
    try {
      await assertDeviceAvailable(deviceId, '__new__')
    } catch (e) {
      if (e instanceof DeviceConflictError) {
        return NextResponse.json(
          {
            error: 'DEVICE_LIMIT',
            message: 'This device already has a Clipzila account. One account per device.',
          },
          { status: 403 }
        )
      }
      throw e
    }

    const passwordHash = await hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        credits: 15,
        role: 'FREE',
        referredByAffiliateId: affiliateId,
        referredAt: affiliateId ? new Date() : null,
      },
    })

    if (affiliateId) {
      await prisma.referralConversion.create({
        data: {
          affiliateId,
          userId: user.id,
          type: 'SIGNUP',
        },
      }).catch((err) => console.error('[referral] signup conversion error:', err))

      // Reward the referring user with +5 bonus credits
      if (affiliateOwnerUserId) {
        await prisma.user.update({
          where: { id: affiliateOwnerUserId },
          data: { credits: { increment: 5 } },
        }).catch((err) => console.error('[referral] credit reward error:', err))

        await prisma.creditTransaction.create({
          data: {
            userId: affiliateOwnerUserId,
            amount: 5,
            type: 'bonus',
            description: `Referral bonus for inviting ${user.name || user.email}`,
          },
        }).catch((err) => console.error('[referral] tx log error:', err))
      }
    }

    // Bind this device to the new account.
    await bindDevice(deviceId, user.id, userAgent)

    // Email verification — account exists but can't log in until confirmed.
    const { token, tokenHash } = generateVerificationToken()
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      await sendEmail({
        to: user.email,
        subject: 'Confirm your Clipzila email',
        html: verificationEmailHtml(`${appUrl}/verify-email?token=${token}`),
      })
    } catch (err) {
      console.error('Failed to deliver verification email:', err)
    }

    await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        amount: 15,
        type: 'bonus',
        description: 'Starting credits for new account',
      },
    })

    const { passwordHash: _, ...userWithoutPassword } = user
    return NextResponse.json({ user: userWithoutPassword })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
