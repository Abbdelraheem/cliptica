import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const userSession = await auth()
    if (!userSession?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await props.params

    const target = await prisma.session.findUnique({
      where: { id },
    })

    if (!target || target.userId !== userSession.user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    await prisma.session.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'Session revoked' })
  } catch (error) {
    console.error('Revoke session error:', error)
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 })
  }
}
