import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes, createHash } from 'crypto'
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
    const sanitized = keys.map((k: { id: string; name: string; key?: string | null; lastUsed: Date | null; createdAt: Date }) => {
      let maskedKey = 'nlg_live_••••'
      if (k.key && typeof k.key === 'string' && k.key.startsWith('nlg_live_')) {
        maskedKey = `nlg_live...${k.key.slice(-4)}`
      }
      return {
        id: k.id,
        name: k.name,
        maskedKey,
        lastUsed: k.lastUsed,
        createdAt: k.createdAt,
      }
    })

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

    // Generate secure API key and store only its SHA-256 hash at rest
    const rawKey = 'nlg_live_' + randomBytes(24).toString('hex')
    const keyHash = createHash('sha256').update(rawKey).digest('hex')

    const created = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        name: validated.data.name,
        key: keyHash,
      },
    })

    // Return the full plaintext key ONCE upon creation
    return NextResponse.json({
      key: {
        id: created.id,
        name: created.name,
        rawKey,
        createdAt: created.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Create API key error:', error)
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }
}
