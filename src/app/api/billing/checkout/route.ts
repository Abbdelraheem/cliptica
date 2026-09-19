import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://clipzila.com'
  const { searchParams } = new URL(request.url)
  const plan = searchParams.get('plan')
  const pack = searchParams.get('pack')

  const url = new URL('/dashboard/billing', baseUrl)
  if (plan) url.searchParams.set('plan', plan)
  if (pack) url.searchParams.set('pack', pack)

  return NextResponse.redirect(url, 307)
}