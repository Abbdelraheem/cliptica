import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  amount: z.number().int().min(-100000).max(100000),
  description: z.string().trim().min(3).max(200),
})

export async function POST(
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
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }
    const { amount, description } = parsed.data

    const current = await prisma.user.findUnique({
      where: { id },
      select: { credits: true },
    })
    if (!current) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (current.credits + amount < 0) {
      return NextResponse.json({ error: 'Insufficient credits to remove that many' }, { status: 400 })
    }

    const [, user] = await prisma.$transaction([
      prisma.creditTransaction.create({
        data: {
          userId: id,
          amount,
          type: 'bonus',
          description,
        },
      }),
      prisma.user.update({
        where: { id },
        data: { credits: { increment: amount } },
        select: { id: true, credits: true, updatedAt: true },
      }),
    ])

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Admin credits adjust error:', error)
    return NextResponse.json({ error: 'Failed to adjust credits' }, { status: 500 })
  }
}