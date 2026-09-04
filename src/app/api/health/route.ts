import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const start = Date.now()
  
  // Check database connectivity
  let dbStatus = 'healthy'
  let dbLatency = 0
  try {
    const startDb = Date.now()
    await prisma.$queryRaw`SELECT 1`
    dbLatency = Date.now() - startDb
  } catch (error) {
    dbStatus = 'unhealthy'
  }
  
  // Check R2 connectivity (if configured)
  let r2Status = 'healthy'
  try {
    // Simple check - if R2 env vars are set, we assume it's configured
    if (!process.env.R2_ENDPOINT || !process.env.R2_BUCKET || !process.env.R2_ACCESS_KEY_ID) {
      r2Status = 'not_configured'
    }
  } catch {
    r2Status = 'unhealthy'
  }
  
  // Check Stripe (if configured)
  let stripeStatus = 'healthy'
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    stripeStatus = 'not_configured'
  }
  
  // Check AI services
  let aiStatus = 'healthy'
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    aiStatus = 'not_configured'
  }
  
  // Overall status
  const overallStatus = dbStatus === 'healthy' ? 'healthy' : 'degraded'
  
  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? '0.1.0',
    checks: {
      database: {
        status: dbStatus,
        latency_ms: dbLatency,
      },
      storage: {
        status: r2Status,
      },
      payments: {
        status: stripeStatus,
      },
      ai: {
        status: aiStatus,
      },
    },
    system: {
      memory: {
        used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external_mb: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      cpu: process.cpuUsage(),
      pid: process.pid,
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  }
  
  const statusCode = overallStatus === 'healthy' ? 200 : 503
  
  return NextResponse.json(response, { 
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Check': 'true',
    }
  })
}