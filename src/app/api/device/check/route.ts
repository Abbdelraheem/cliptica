import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertDeviceAvailable, bindDevice } from '@/lib/device'
import { isAdminEmail } from '@/lib/admin'
import { enforceRequestRateLimit, apiMutationLimiter } from '@/lib/rate-limit'

const bodySchema = z.object({
  deviceId: z.string().min(8).max(256),
  /** When provided (login form), conflict is checked against THIS email's account. */
  email: z.string().email().optional(),
})

export async function POST(request: Request) {
  try {
    const rateLimited = await enforceRequestRateLimit(apiMutationLimiter, request, 'device-check')
    if (rateLimited) return rateLimited

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    const { deviceId, email } = parsed.data

    // Mode 1 — login form: check the device against the account being opened.
    if (email) {
      const cleanEmail = email.trim().toLowerCase()
      if (isAdminEmail(cleanEmail)) {
        return NextResponse.json({ status: 'ok', bound: false })
      }

      const user = await prisma.user.findFirst({
        where: { email: { equals: cleanEmail, mode: 'insensitive' } },
        select: { id: true, role: true, email: true },
      })
      if (!user || user.role === 'ADMIN' || isAdminEmail(user.email)) {
        return NextResponse.json({ status: 'ok', bound: false })
      }
      try {
        await assertDeviceAvailable(deviceId, user.id, user.role, user.email)
      } catch {
        return NextResponse.json(
          {
            status: 'device_conflict',
            message: 'This device already has another Clipzila account. One account per device.',
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
    if (session.user.role === 'ADMIN' || isAdminEmail(session.user.email)) {
      return NextResponse.json({ status: 'ok', bound: false })
    }

    try {
      await assertDeviceAvailable(deviceId, session.user.id, session.user.role, session.user.email)
    } catch {
      return NextResponse.json(
        {
          status: 'device_conflict',
          message: 'This device already has another Clipzila account. One account per device.',
        },
        { status: 403 }
      )
    }

    await bindDevice(
      deviceId,
      session.user.id,
      request.headers.get('user-agent'),
      session.user.role,
      session.user.email
    )
    return NextResponse.json({ status: 'ok', bound: true })
  } catch (error) {
    console.error('device/check error:', error)
    return NextResponse.json({ error: 'Check failed' }, { status: 500 })
  }
}
