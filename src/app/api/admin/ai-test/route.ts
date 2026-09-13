import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    let testKey = body.key?.trim()

    if (!testKey) {
      // Check DB Setting first, then process.env
      const dbSetting = await prisma.setting.findUnique({
        where: { key: 'GROQ_API_KEY' },
      })
      testKey = dbSetting?.value?.trim() || process.env.GROQ_API_KEY?.trim()
    }

    if (!testKey) {
      return NextResponse.json({
        success: false,
        error: 'No Groq API key configured in database, environment, or request payload.',
      }, { status: 400 })
    }

    const maskedKey = testKey.length > 10 
      ? `${testKey.slice(0, 6)}...${testKey.slice(-4)}` 
      : '***'

    const t0 = Date.now()

    // 1. Test model list endpoint
    const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${testKey}`,
      },
    })

    const latencyMs = Date.now() - t0

    if (!modelsRes.ok) {
      const errText = await modelsRes.text()
      return NextResponse.json({
        success: false,
        keyMasked: maskedKey,
        statusCode: modelsRes.status,
        error: `Groq API authentication failed (${modelsRes.status}): ${errText}`,
        latencyMs,
      }, { status: 200 })
    }

    const modelsData = await modelsRes.json()
    const modelIds: string[] = (modelsData.data || []).map((m: { id: string }) => m.id)

    // 2. Test chat completion endpoint with fast model
    const chatT0 = Date.now()
    const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Reply with the word OK.' }],
        max_tokens: 10,
      }),
    })

    const chatLatencyMs = Date.now() - chatT0
    let chatReply = ''
    const chatOk = chatRes.ok

    if (chatRes.ok) {
      const chatData = await chatRes.json()
      chatReply = chatData.choices?.[0]?.message?.content?.trim() || ''
    }

    return NextResponse.json({
      success: true,
      keyMasked: maskedKey,
      latencyMs,
      chatTest: {
        ok: chatOk,
        status: chatRes.status,
        latencyMs: chatLatencyMs,
        reply: chatReply,
      },
      hasWhisperLarge: modelIds.includes('whisper-large-v3'),
      hasLlama33: modelIds.includes('llama-3.3-70b-versatile'),
      availableModelsCount: modelIds.length,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
