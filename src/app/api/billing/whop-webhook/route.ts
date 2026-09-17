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

function verifyWhopSignature(
  rawBody: string,
  headersList: { get: (name: string) => string | null },
  secret: string
): boolean {
  if (!secret) return true

  const sigHeader =
    headersList.get('webhook-signature') ||
    headersList.get('whop-signature') ||
    headersList.get('x-whop-signature') ||
    headersList.get('svix-signature')

  if (!sigHeader) return false

  const msgId =
    headersList.get('webhook-id') ||
    headersList.get('whop-id') ||
    headersList.get('svix-id') ||
    headersList.get('x-webhook-id') ||
    ''

  const timestamp =
    headersList.get('webhook-timestamp') ||
    headersList.get('whop-timestamp') ||
    headersList.get('svix-timestamp') ||
    headersList.get('x-webhook-timestamp') ||
    ''

  // Extract all signatures from the header (e.g. "v1,abc v1,def" or "t=123,v1=abc")
  const candidateSignatures: string[] = []
  const tokens = sigHeader.split(/[,\s]+/)
  for (const token of tokens) {
    if (token.startsWith('v1=')) {
      candidateSignatures.push(token.slice(3))
    } else if (token.startsWith('v1,')) {
      candidateSignatures.push(token.slice(3))
    } else if (token.startsWith('t=')) {
      // timestamp token, ignore
    } else if (token.length > 10) {
      candidateSignatures.push(token)
    }
  }

  // Also extract timestamp from t= in sigHeader if not in headers
  let effectiveTimestamp = timestamp
  if (!effectiveTimestamp && sigHeader.includes('t=')) {
    const tToken = tokens.find((t) => t.startsWith('t='))
    if (tToken) effectiveTimestamp = tToken.slice(2)
  }

  // Prepare payload variants
  const payloads: string[] = []
  if (msgId && effectiveTimestamp) {
    payloads.push(`${msgId}.${effectiveTimestamp}.${rawBody}`)
  }
  if (effectiveTimestamp) {
    payloads.push(`${effectiveTimestamp}.${rawBody}`)
  }
  payloads.push(rawBody)

  // Prepare secret key variants
  const rawKey = secret.replace(/^(ws_|whsec_)/, '')
  const keyVariants: Buffer[] = []
  try {
    keyVariants.push(Buffer.from(secret, 'utf8'))
  } catch {}
  try {
    keyVariants.push(Buffer.from(rawKey, 'utf8'))
  } catch {}
  try {
    if (/^[0-9a-fA-F]+$/.test(rawKey) && rawKey.length % 2 === 0) {
      keyVariants.push(Buffer.from(rawKey, 'hex'))
    }
  } catch {}
  try {
    keyVariants.push(Buffer.from(rawKey, 'base64'))
  } catch {}

  // Check all combinations
  for (const key of keyVariants) {
    for (const payload of payloads) {
      try {
        const expectedB64 = crypto.createHmac('sha256', key).update(payload).digest('base64')
        const expectedHex = crypto.createHmac('sha256', key).update(payload).digest('hex')

        for (const sig of candidateSignatures) {
          if (sig.length === expectedB64.length) {
            if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedB64))) {
              return true
            }
          }
          if (sig.length === expectedHex.length) {
            if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedHex))) {
              return true
            }
          }
        }
      } catch {}
    }
  }

  return false
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const headersList = await headers()

    const secret = process.env.WHOP_WEBHOOK_SECRET || ''

    if (secret && process.env.NODE_ENV === 'production') {
      const isValid = verifyWhopSignature(rawBody, headersList, secret)
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
      planOrProductName.includes('lite') ||
      (amount >= 14 && amount <= 16)
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
      (amount >= 17 && amount < 25)
    ) {
      addedCredits = 50
      description = 'Whop Credit Pack: 50 Credits'
    } else {
      addedCredits = 50
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
