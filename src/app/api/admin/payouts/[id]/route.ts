import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  status: z.enum(['APPROVED', 'PAID']),
  notes: z.string().trim().max(400).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    const { status, notes } = parsed.data

    const payout = await prisma.payout.findUnique({ where: { id } })
    if (!payout) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (payout.status === 'PAID') {
      return NextResponse.json({ error: 'Payout already paid' }, { status: 400 })
    }

    const updated = await prisma.payout.update({
      where: { id },
      data: {
        status,
        paidAt: status === 'PAID' ? new Date() : payout.paidAt,
        ...(notes ? { notes } : {}),
      },
      select: { id: true, status: true, paidAt: true, notes: true },
    })

    return NextResponse.json({ payout: updated })
  } catch (error) {
    console.error('Admin payout update error:', error)
    return NextResponse.json({ error: 'Failed to update payout' }, { status: 500 })
  }
}