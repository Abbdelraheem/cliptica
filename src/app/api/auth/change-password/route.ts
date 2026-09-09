import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { compare, hash } from 'bcryptjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendEmail, passwordChangedEmailHtml } from '@/lib/email'

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(100),
  confirmPassword: z.string().min(8),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const validated = changePasswordSchema.safeParse(body)
    if (!validated.success) {
      const firstError = validated.error.errors[0]?.message || 'Invalid input'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { currentPassword, newPassword } = validated.data

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, passwordHash: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If user already has a password, verify current password
    if (user.passwordHash) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
      }
      const isValid = await compare(currentPassword, user.passwordHash)
      if (!isValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }
    }

    const newPasswordHash = await hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    })

    // Send email notification about password change
    if (user.email) {
      sendEmail({
        to: user.email,
        subject: 'Your NOLOGY password was changed',
        html: passwordChangedEmailHtml(),
      }).catch((e) => console.error('[change-password] failed to send email notification:', e))
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
