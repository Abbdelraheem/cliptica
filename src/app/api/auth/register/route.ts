import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { assertDeviceAvailable, bindDevice, DeviceConflictError } from '@/lib/device'
import { enforceRequestRateLimit, registerLimiter } from '@/lib/rate-limit'
import { generateVerificationToken, sendEmail } from '@/lib/email'
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

    const { email, password, name, deviceId } = validated.data
    const userAgent = request.headers.get('user-agent')

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
            message: 'This device already has a Nology account. One account per device.',
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
        credits: 40,
        role: 'FREE',
      },
    })

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
        subject: 'Confirm your NOLOGY email',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#f5f2ea;background:#101010;border-radius:16px">
            <p style="letter-spacing:0.3em;font-size:12px;color:#d4af37">NOLOGY</p>
            <h1 style="font-size:22px;margin:16px 0">One click to verify</h1>
            <p style="color:#b8b4a8;line-height:1.6">Welcome to NOLOGY. Confirm your email address to activate your account and start clipping.</p>
            <p style="margin:28px 0">
              <a href="${appUrl}/verify-email?token=${token}" style="background:#d4af37;color:#101010;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold">Verify my email</a>
            </p>
            <p style="color:#6b675c;font-size:13px">This link expires in 24 hours.</p>
          </div>
        `.trim(),
      })
    } catch (err) {
      console.error('Failed to deliver verification email:', err)
    }

    await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        amount: 40,
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
