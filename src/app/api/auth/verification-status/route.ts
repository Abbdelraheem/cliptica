import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { z } from 'zod'
import { enforceRequestRateLimit, loginEmailLimiter } from '@/lib/rate-limit'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

/**
 * Pre-check used by the login page so unverified accounts get a precise
 * message instead of the generic "invalid credentials" one. Only answers
 * truthfully when the supplied password is actually correct.
 */
export async function POST(request: Request) {
  try {
    const limited = await enforceRequestRateLimit(loginEmailLimiter, request, 'verification-status')
    if (limited) return limited

    const body = await request.json()
    const validated = schema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json({ needsVerification: false })
    }

    const { email, password } = validated.data
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

    if (!user || !user.passwordHash || user.emailVerified) {
      return NextResponse.json({ needsVerification: false })
    }

    const isValid = await compare(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json({ needsVerification: false })
    }

    return NextResponse.json({ needsVerification: true })
  } catch (error) {
    console.error('Verification status error:', error)
    return NextResponse.json({ needsVerification: false })
  }
}
