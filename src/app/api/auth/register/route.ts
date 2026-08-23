import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { z } from 'zod'
import { assertDeviceAvailable, bindDevice, DeviceConflictError } from '@/lib/device'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100).optional(),
  deviceId: z.string().min(8).max(256),
})

export async function POST(request: Request) {
  try {
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
