import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

globalForPrisma.prisma = prisma

/**
 * Resilient database execution helper that automatically retries transient
 * connection errors (e.g. Neon serverless cold starts or P1001 unreachable errors).
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 600
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastError = err
      const isTransient =
        err instanceof Error &&
        (err.message.includes('Can\'t reach database server') ||
          err.message.includes('P1001') ||
          err.message.includes('Connection pool timeout') ||
          err.message.includes('connection closed') ||
          err.message.includes('ECONNRESET'))

      if (!isTransient || attempt === retries) {
        throw err
      }

      await new Promise((res) => setTimeout(res, delayMs * (attempt + 1)))
    }
  }
  throw lastError
}