import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createKeySchema = z.object({
  name: z.string().trim().min(1, 'Key name is required').max(60, 'Key name too long'),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        key: true,
        lastUsed: true,
        createdAt: true,
      },
    })

    // Mask keys so secrets are never re-exposed
    const sanitized = keys.map((k) => ({
      id: k.id,
      name: k.name,
      maskedKey: k.key.length > 12 ? (k.key.slice(0, 8) + '...' + k.key.slice(-4)) : '••••••••',
      lastUsed: k.lastUsed,
      createdAt: k.createdAt,
    }))

    return NextResponse.json({ keys: sanitized })
  } catch (error) {
    console.error('List API keys error:', error)
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const validated = createKeySchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.errors[0]?.message || 'Invalid key name' }, { status: 400 })
    }

    // Generate secure API key
    const rawKey = 'nlg_live_' + randomBytes(24).toString('hex')

    const created = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        name: validated.data.name,
        key: rawKey,
      },
    })

    // Return the full plaintext key ONCE
    return NextResponse.json({
      key: {
        id: created.id,
        name: created.name,
        rawKey: created.key,
        createdAt: created.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Create API key error:', error)
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }
}
