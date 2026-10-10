import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  // Check database connectivity
  let dbHealthy = true
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (error) {
    console.error('DB health check failed:', error)
    dbHealthy = false
  }

  const status = dbHealthy ? 'healthy' : 'degraded'
  const statusCode = dbHealthy ? 200 : 503

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
    },
    {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'true',
      },
    }
  )
}