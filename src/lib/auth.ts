import type { NextAuthOptions } from 'next-auth'
import { getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import { prisma } from '@/lib/prisma'
import { compare } from 'bcryptjs'
import { z } from 'zod'
import { assertDeviceAvailable, bindDevice } from '@/lib/device'
import { enforceRateLimit, loginEmailLimiter, loginIpLimiter, getClientIp } from '@/lib/rate-limit'

/** Convenience helper so API routes can `await auth()` */
export async function auth() {
  return getServerSession(authOptions)
}

/**
 * Server-side ADMIN gate for layouts & API routes.
 * Returns the session only when the caller is an ADMIN, otherwise null.
 */
export async function getAdminSession() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') return null
  return session
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  deviceId: z.string().max(256).optional(),
})

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user }) {
      // OAuth providers have no adapter here — provision/link the local
      // account ourselves on first sign-in. Credentials logins already
      // resolved a database user inside authorize().
      if (!user.email) return false

      const existing = await prisma.user.findUnique({
        where: { email: user.email.toLowerCase() },
        select: { id: true, emailVerified: true, passwordHash: true },
      })

      if (!existing) {
        const created = await prisma.user.create({
          data: {
            email: user.email.toLowerCase(),
            name: user.name ?? null,
            avatar: user.image ?? null,
            emailVerified: new Date(),
            credits: 40,
            role: 'FREE',
          },
        })
        await prisma.creditTransaction.create({
          data: {
            userId: created.id,
            amount: 40,
            type: 'bonus',
            description: 'Starting credits for new account',
          },
        })
        return true
      }

      // An unverified credentials account cannot be entered through OAuth —
      // that would silently bypass the email-verification gate.
      if (existing.passwordHash && !existing.emailVerified) return false

      return true
    },
    async jwt({ token, user, trigger, session }) {
      if (user?.email) {
        // Always resolve identity from OUR database (covers both credentials
        // and OAuth, whose profile ids are provider-specific, not ours).
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: { id: true, role: true, credits: true },
        })
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
          token.credits = dbUser.credits
        }
      }
      if (trigger === 'update' && session) {
        token.credits = (session as { credits?: number }).credits ?? (token.credits as number)
        token.role = (session as { role?: string }).role ?? (token.role as string)
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as { id?: string }).id = token.id as string
        ;(session.user as { role?: string }).role = token.role as string
        ;(session.user as { credits?: number }).credits = token.credits as number
      }
      return session
    },
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        deviceId: { label: 'Device ID', type: 'text' },
      },
      async authorize(credentials, request) {
        const validated = loginSchema.safeParse(credentials)
        if (!validated.success) return null

        const { email, password, deviceId } = validated.data
        const ip = getClientIp(request)
        const limited =
          (await enforceRateLimit(loginIpLimiter, `login-ip:${ip}`)) ??
          (await enforceRateLimit(loginEmailLimiter, `login-email:${email.toLowerCase()}`))
        if (limited) return null

        const user = await prisma.user.findUnique({ where: { email } })

        if (!user || !user.passwordHash) return null

        const isValid = await compare(password, user.passwordHash)
        if (!isValid) return null

        // Unverified accounts can't sign in — the login page surfaces a
        // precise message via /api/auth/verification-status.
        if (!user.emailVerified) return null

        // One account per device — server-side enforcement.
        if (deviceId) {
          try {
            await assertDeviceAvailable(deviceId, user.id)
          } catch {
            return null
          }
          try {
            await bindDevice(deviceId, user.id)
          } catch {
            /* binding is best-effort here; conflict above is the gate */
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role,
          credits: user.credits,
        }
      },
    }),
  ],
}
