import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateAffiliateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
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
    const body = await request.json()
    const parsed = updateAffiliateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const affiliate = await prisma.affiliate.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.commissionRate !== undefined ? { commissionRate: parsed.data.commissionRate } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.email !== undefined ? { email: parsed.data.email || null } : {}),
      },
    })

    return NextResponse.json({ affiliate })
  } catch (error) {
    console.error('Affiliate PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update affiliate' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    await prisma.affiliate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Affiliate DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete affiliate' }, { status: 500 })
  }
}
