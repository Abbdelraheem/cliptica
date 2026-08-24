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
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = (user as unknown as { role?: string }).role ?? 'FREE'
        token.credits = (user as unknown as { credits?: number }).credits ?? 0
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
