import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100).optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = registerSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid input', details: validated.error.flatten() }, { status: 400 })
    }

    const { email, password, name } = validated.data

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // Hash password
    const passwordHash = await hash(password, 12)

    // Create user with free credits
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        credits: 40,
        role: 'FREE',
      },
    })

    // Create credit transaction for starting credits
    await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        amount: 40,
        type: 'bonus',
        description: 'Starting credits for new account',
      },
    })

    // Return user without password
    const { passwordHash: _, ...userWithoutPassword } = user
    return NextResponse.json({ user: userWithoutPassword })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}