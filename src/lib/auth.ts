import type { NextAuthOptions } from 'next-auth'
import { getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import { prisma } from '@/lib/prisma'
import { compare } from 'bcryptjs'
import { z } from 'zod'

/** Convenience helper so API routes can `await auth()` */
export async function auth() {
  return getServerSession(authOptions)
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
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
      },
      async authorize(credentials) {
        const validated = loginSchema.safeParse(credentials)
        if (!validated.success) return null

        const { email, password } = validated.data
        const user = await prisma.user.findUnique({ where: { email } })

        if (!user || !user.passwordHash) return null

        const isValid = await compare(password, user.passwordHash)
        if (!isValid) return null

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
