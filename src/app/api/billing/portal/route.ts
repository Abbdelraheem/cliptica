import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://clipzila.com'
  return NextResponse.redirect(new URL('/api/billing/paddle-portal', baseUrl), 307)
}