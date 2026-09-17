import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

interface WhopItem {
  id?: string
  name?: string
}

interface WhopData {
  id?: string
  user_id?: string
  email?: string
  final_amount?: number
  amount?: number
  plan_id?: string
  product_id?: string
  title?: string
  custom_fields?: Record<string, string>
  metadata?: Record<string, string>
  user?: { email?: string }
  customer?: { email?: string }
  product?: WhopItem
  plan?: WhopItem
  line_items?: Array<{ product?: WhopItem; plan?: WhopItem }>
}

interface WhopPayload {
  action?: string
  event?: string
  type?: string
  id?: string
  email?: string
  metadata?: Record<string, string>
  data?: WhopData
}

function verifyWhopSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!secret) return true
  if (!signatureHeader) return false

  try {
    // 1. Try Svix / Whop format: t=TIMESTAMP,v1=SIGNATURE
    if (signatureHeader.includes('v1=')) {
      const parts = signatureHeader.split(',')
      const timestampPart = parts.find((p) => p.startsWith('t='))?.slice(2)
      const sigPart = parts.find((p) => p.startsWith('v1='))?.slice(3)
      if (sigPart) {
        const toSign = timestampPart ? `${timestampPart}.${rawBody}` : rawBody
        const expected = crypto.createHmac('sha256', secret).update(toSign).digest('hex')
        if (sigPart.length === expected.length && crypto.timingSafeEqual(Buffer.from(sigPart), Buffer.from(expected))) {
          return true
        }
      }
    }

    // 2. Try raw HMAC-SHA256 hex
    const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    if (signatureHeader.length === expectedHex.length && crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedHex))) {
      return true
    }

    // 3. Try raw HMAC-SHA256 base64
    const expectedBase64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
    if (signatureHeader.length === expectedBase64.length && crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedBase64))) {
      return true
    }

    return false
  } catch (err) {
    console.error('[Whop Webhook] Verification error:', err)
    return false
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const headersList = await headers()

    const signature =
      headersList.get('whop-signature') ||
      headersList.get('webhook-signature') ||
      headersList.get('x-whop-signature')

    const secret = process.env.WHOP_WEBHOOK_SECRET || ''

    if (secret && process.env.NODE_ENV === 'production') {
      const isValid = verifyWhopSignature(rawBody, signature, secret)
      if (!isValid) {
        console.warn('[Whop Webhook] Signature mismatch or invalid signature header')
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
      }
    }

    let payload: WhopPayload
    try {
      payload = JSON.parse(rawBody) as WhopPayload
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 })
    }

    const action = payload.action || payload.event || payload.type
    console.log(`[Whop Webhook] Received action: "${action}"`)

    const relevantActions = ['payment.succeeded', 'payment.created', 'membership.went_valid', 'checkout.completed']
    if (action && !relevantActions.some((a) => action.toLowerCase().includes(a))) {
      return NextResponse.json({ received: true, ignoredAction: action })
    }

    const data: WhopData = payload.data || (payload as unknown as WhopData)

    const eventId = String(data.id || payload.id || `whop_${Date.now()}`)

    const existing = await prisma.processedWebhookEvent.findUnique({
      where: { whopEventId: eventId },
    })

    if (existing) {
      console.log(`[Whop Webhook] Event "${eventId}" already processed. Skipping.`)
      return NextResponse.json({ received: true, alreadyProcessed: true })
    }

    const metadataUserId =
      data.metadata?.userId ||
      data.custom_fields?.userId ||
      data.metadata?.user_id ||
      payload.metadata?.userId

    const customerEmail =
      data.email ||
      data.user?.email ||
      data.customer?.email ||
      payload.email

    let user = null
    if (metadataUserId) {
      user = await prisma.user.findUnique({ where: { id: metadataUserId } })
    }

    if (!user && customerEmail) {
      user = await prisma.user.findUnique({
        where: { email: customerEmail.toLowerCase().trim() },
      })
    }

    if (!user) {
      console.warn(`[Whop Webhook] Could not associate purchase to user. metadataUserId="${metadataUserId}", email="${customerEmail}"`)
      await prisma.processedWebhookEvent.create({
        data: { whopEventId: eventId },
      })
      return NextResponse.json({ received: true, warning: 'User not found' })
    }

    const planOrProductName = String(
      data.product?.name ||
      data.plan?.name ||
      data.line_items?.[0]?.product?.name ||
      data.title ||
      ''
    ).toLowerCase()

    const planIdOrSlug = String(
      data.plan_id ||
      data.product_id ||
      data.plan?.id ||
      data.product?.id ||
      ''
    ).toLowerCase()

    const amount = Number(data.final_amount ?? data.amount ?? 0)

    let targetRole: 'CLIPPER' | 'STUDIO' | null = null
    let addedCredits = 0
    let description = ''

    if (
      planOrProductName.includes('pro') ||
      planIdOrSlug.includes('pro') ||
      amount >= 55
    ) {
      targetRole = 'STUDIO'
      addedCredits = 400
      description = 'Whop Subscription: Pro Creator Plan (400 Credits)'
    } else if (
      planOrProductName.includes('starter') ||
      planIdOrSlug.includes('starter') ||
      (amount >= 25 && amount < 55)
    ) {
      targetRole = 'CLIPPER'
      addedCredits = 120
      description = 'Whop Subscription: Starter Plan (120 Credits)'
    } else if (
      planOrProductName.includes('basic') ||
      planIdOrSlug.includes('basic') ||
      planOrProductName.includes('lite')
    ) {
      targetRole = 'CLIPPER'
      addedCredits = 50
      description = 'Whop Subscription: Basic Plan (50 Credits)'
    } else if (
      planOrProductName.includes('500') ||
      planIdOrSlug.includes('500') ||
      (amount >= 80 && amount < 100)
    ) {
      addedCredits = 500
      description = 'Whop Credit Pack: 500 Credits'
    } else if (
      planOrProductName.includes('150') ||
      planIdOrSlug.includes('150') ||
      (amount >= 30 && amount < 40)
    ) {
      addedCredits = 150
      description = 'Whop Credit Pack: 150 Credits'
    } else if (
      planOrProductName.includes('50') ||
      planIdOrSlug.includes('50') ||
      (amount >= 10 && amount < 25)
    ) {
      targetRole = 'CLIPPER'
      addedCredits = 50
      description = 'Whop Purchase: 50 Credits / Basic Plan'
    } else {
      addedCredits = 120
      description = `Whop Purchase (${planOrProductName || 'Credits'})`
    }

    await prisma.$transaction(async (tx) => {
      await tx.processedWebhookEvent.create({
        data: { whopEventId: eventId },
      })

      await tx.user.update({
        where: { id: user.id },
        data: {
          credits: { increment: addedCredits },
          ...(targetRole ? { role: targetRole } : {}),
        },
      })

      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: addedCredits,
          type: 'PURCHASE',
          description: `${description} [Whop Ref: ${eventId}]`,
        },
      })
    })

    console.log(`[Whop Webhook] Successfully added +${addedCredits} credits to user ${user.id} (${user.email}). New role: ${targetRole || user.role}`)

    return NextResponse.json({
      received: true,
      userId: user.id,
      creditsAdded: addedCredits,
      role: targetRole || user.role,
    })
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Webhook internal error'
    console.error('[Whop Webhook] Unhandled error:', error)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
