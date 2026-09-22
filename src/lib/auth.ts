import type { NextAuthOptions } from 'next-auth'
import { getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { compare } from 'bcryptjs'
import { z } from 'zod'
import { assertDeviceAvailable, bindDevice } from '@/lib/device'
import { isAdminEmail } from '@/lib/admin'
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
      const cleanEmail = user.email.trim().toLowerCase()
      const isAdm = isAdminEmail(cleanEmail)

      const existing = await prisma.user.findFirst({
        where: { email: { equals: cleanEmail, mode: 'insensitive' } },
        select: { id: true, emailVerified: true, passwordHash: true, role: true },
      })

      if (!existing) {
        let affiliateId: string | null = null
        let affiliateOwnerUserId: string | null = null
        try {
          const cookieStore = await cookies()
          const refCookie = (cookieStore.get('clipzila_ref')?.value || cookieStore.get('cliptica_ref')?.value)?.trim().toLowerCase()
          if (refCookie) {
            const affiliate = await prisma.affiliate.findUnique({
              where: { code: refCookie },
              select: { id: true, isActive: true, userId: true },
            })
            if (affiliate?.isActive) {
              affiliateId = affiliate.id
              affiliateOwnerUserId = affiliate.userId
            }
          }
        } catch {
          // ignore when cookies unavailable
        }

        const created = await prisma.user.create({
          data: {
            email: cleanEmail,
            name: user.name ?? null,
            avatar: user.image ?? null,
            emailVerified: new Date(),
            credits: isAdm ? 999999 : 5,
            role: isAdm ? 'ADMIN' : 'FREE',
            referredByAffiliateId: affiliateId,
            referredAt: affiliateId ? new Date() : null,
          },
        })
        await prisma.creditTransaction.create({
          data: {
            userId: created.id,
            amount: isAdm ? 999999 : 5,
            type: 'bonus',
            description: 'Starting credits for new account',
          },
        })

        if (affiliateId) {
          await prisma.referralConversion.create({
            data: {
              affiliateId,
              userId: created.id,
              type: 'SIGNUP',
            },
          }).catch((err) => console.error('[referral] signup conversion error:', err))

          if (affiliateOwnerUserId) {
            await prisma.user.update({
              where: { id: affiliateOwnerUserId },
              data: { credits: { increment: 5 } },
            }).catch((err) => console.error('[referral] credit reward error:', err))

            await prisma.creditTransaction.create({
              data: {
                userId: affiliateOwnerUserId,
                amount: 5,
                type: 'bonus',
                description: `Referral bonus for inviting ${created.name || created.email}`,
              },
            }).catch((err) => console.error('[referral] tx log error:', err))
          }
        }

        return true
      }

      // Self-heal: ensure admin role
      if (isAdm && existing.role !== 'ADMIN') {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: 'ADMIN' },
        }).catch(() => {})
      }

      // An unverified credentials account cannot be entered through OAuth —
      // that would silently bypass the email-verification gate (admins exempt).
      if (!isAdm && existing.passwordHash && !existing.emailVerified) return false

      return true
    },
    async jwt({ token, user, trigger, session }) {
      if (user?.email) {
        const cleanEmail = user.email.trim().toLowerCase()
        const isAdm = isAdminEmail(cleanEmail)
        const dbUser = await prisma.user.findFirst({
          where: { email: { equals: cleanEmail, mode: 'insensitive' } },
          select: { id: true, role: true, credits: true, name: true, canCreateCampaigns: true },
        })
        if (dbUser) {
          const role = isAdm ? 'ADMIN' : dbUser.role
          token.id = dbUser.id
          token.role = role
          token.credits = role === 'ADMIN' ? 999999 : dbUser.credits
          token.name = dbUser.name ?? user.name ?? token.name
          token.canCreateCampaigns = role === 'ADMIN' || Boolean(dbUser.canCreateCampaigns)
        }
      } else if (token.id && (!token.role || token.role === 'ADMIN' || isAdminEmail(token.email as string))) {
        // Refresh role and credits periodically for active sessions
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, credits: true, canCreateCampaigns: true, email: true },
          })
          if (fresh) {
            const isAdm = fresh.role === 'ADMIN' || isAdminEmail(fresh.email)
            token.role = isAdm ? 'ADMIN' : fresh.role
            token.credits = isAdm ? 999999 : fresh.credits
            token.canCreateCampaigns = isAdm || Boolean(fresh.canCreateCampaigns)
          }
        } catch {}
      }
      if (trigger === 'update' && session) {
        const s = session as { credits?: number; role?: string; name?: string; canCreateCampaigns?: boolean }
        if (s.credits !== undefined) token.credits = token.role === 'ADMIN' ? 999999 : s.credits
        if (s.role !== undefined) token.role = s.role
        if (s.name !== undefined) token.name = s.name
        if (s.canCreateCampaigns !== undefined) token.canCreateCampaigns = token.role === 'ADMIN' || s.canCreateCampaigns
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const isAdmin = token.role === 'ADMIN'
        ;(session.user as { id?: string }).id = token.id as string
        ;(session.user as { role?: string }).role = (token.role as string) || 'FREE'
        ;(session.user as { credits?: number }).credits = isAdmin ? 999999 : (token.credits as number) ?? 0
        ;(session.user as { canCreateCampaigns?: boolean }).canCreateCampaigns = isAdmin || Boolean(token.canCreateCampaigns)
        session.user.name = (token.name as string | null) ?? session.user.name
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
        const cleanEmail = email.trim().toLowerCase()
        const isAdm = isAdminEmail(cleanEmail)

        const ip = getClientIp(request)
        const limited =
          (await enforceRateLimit(loginIpLimiter, `login-ip:${ip}`)) ??
          (await enforceRateLimit(loginEmailLimiter, `login-email:${cleanEmail}`))
        if (limited) return null

        const user = await prisma.user.findFirst({
          where: { email: { equals: cleanEmail, mode: 'insensitive' } },
        })

        if (!user || !user.passwordHash) return null

        const isValid = await compare(password, user.passwordHash)
        if (!isValid) return null

        // Unverified accounts can't sign in — the login page surfaces a
        // precise message via /api/auth/verification-status (admins exempt).
        if (!user.emailVerified && user.role !== 'ADMIN' && !isAdm) return null

        let userRole = user.role
        if (isAdm && userRole !== 'ADMIN') {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN' },
          }).catch(() => {})
          userRole = 'ADMIN'
        }

        // One account per device — server-side enforcement (Admins fully bypassed).
        if (deviceId && userRole !== 'ADMIN' && !isAdm) {
          try {
            await assertDeviceAvailable(deviceId, user.id, userRole, user.email)
          } catch {
            return null
          }
          try {
            await bindDevice(deviceId, user.id, null, userRole, user.email)
          } catch {
            /* binding is best-effort here; conflict above is the gate */
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: userRole,
          credits: userRole === 'ADMIN' ? 999999 : user.credits,
        }
      },
    }),
  ],
}
