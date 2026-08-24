import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const MOTION_FX_KEY = 'motion_fx'

async function motionEnabled(): Promise<boolean> {
  const s = await prisma.setting.findUnique({ where: { key: MOTION_FX_KEY } })
  return !s || s.value === 'true' // default: on
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({
      enabled: await motionEnabled(),
      isAdmin: session.user.role === 'ADMIN',
    })
  } catch (error) {
    console.error('motion-fx GET error:', error)
    return NextResponse.json({ error: 'Failed to read setting' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const parsed = z.object({ enabled: z.boolean() }).safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    await prisma.setting.upsert({
      where: { key: MOTION_FX_KEY },
      update: { value: String(parsed.data.enabled) },
      create: { key: MOTION_FX_KEY, value: String(parsed.data.enabled) },
    })

    return NextResponse.json({ enabled: parsed.data.enabled })
  } catch (error) {
    console.error('motion-fx PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
  }
}
