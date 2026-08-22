import { DefaultSession, DefaultUser } from 'next-auth'
import { JWT, DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      credits: number
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role: string
    credits: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string
    role: string
    credits: number
  }
}