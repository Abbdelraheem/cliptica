import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertDeviceAvailable, bindDevice } from '@/lib/device'

const bodySchema = z.object({
  deviceId: z.string().min(8).max(256),
  /** When provided (login form), conflict is checked against THIS email's account. */
  email: z.string().email().optional(),
})

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    const { deviceId, email } = parsed.data

    // Mode 1 — login form: check the device against the account being opened.
    if (email) {
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) return NextResponse.json({ status: 'ok', bound: false })
      try {
        await assertDeviceAvailable(deviceId, user.id)
      } catch {
        return NextResponse.json(
          {
            status: 'device_conflict',
            message: 'This device already has another Nology account. One account per device.',
          },
          { status: 403 }
        )
      }
      return NextResponse.json({ status: 'ok', bound: false })
    }

    // Mode 2 — logged-in user (e.g. right after Google sign-in): bind or reject.
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      await assertDeviceAvailable(deviceId, session.user.id)
    } catch {
      return NextResponse.json(
        {
          status: 'device_conflict',
          message: 'This device already has another Nology account. One account per device.',
        },
        { status: 403 }
      )
    }

    await bindDevice(deviceId, session.user.id, request.headers.get('user-agent'))
    return NextResponse.json({ status: 'ok', bound: true })
  } catch (error) {
    console.error('device/check error:', error)
    return NextResponse.json({ error: 'Check failed' }, { status: 500 })
  }
}
