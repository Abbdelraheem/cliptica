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
    const provider = body.provider === 'nvidia' || String(body.key || '').startsWith('nvapi-') ? 'nvidia' : 'groq'
    let testKey = body.key?.trim()

    if (!testKey) {
      const settingKey = provider === 'nvidia' ? 'nvidia_api_key' : 'groq_api_key'
      const envKey = provider === 'nvidia' ? 'NVIDIA_API_KEY' : 'GROQ_API_KEY'
      const dbSetting = await prisma.setting.findUnique({
        where: { key: settingKey },
      })
      testKey = dbSetting?.value?.trim() || process.env[envKey]?.trim()
    }

    if (!testKey) {
      return NextResponse.json({
        success: false,
        provider,
        error: `No ${provider.toUpperCase()} API key configured in database, environment, or request payload.`,
      }, { status: 400 })
    }

    const maskedKey = testKey.length > 10 
      ? `${testKey.slice(0, 6)}...${testKey.slice(-4)}` 
      : '***'

    const t0 = Date.now()

    if (provider === 'nvidia') {
      // 1. Test NVIDIA NIM models or chat completion
      const chatT0 = Date.now()
      const testModel = body.model?.trim() || 'meta/llama-3.3-70b-instruct'

      const chatRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${testKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Reply with the word OK.' }],
          max_tokens: 10,
        }),
      })

      const chatLatencyMs = Date.now() - chatT0
      if (!chatRes.ok) {
        const errText = await chatRes.text().catch(() => '')
        return NextResponse.json({
          success: false,
          provider: 'nvidia',
          keyMasked: maskedKey,
          statusCode: chatRes.status,
          error: `NVIDIA NIM authentication failed (${chatRes.status}): ${errText.slice(0, 200)}`,
          latencyMs: chatLatencyMs,
        }, { status: 200 })
      }

      const chatData = await chatRes.json()
      const chatReply = chatData.choices?.[0]?.message?.content?.trim() || ''

      return NextResponse.json({
        success: true,
        provider: 'nvidia',
        keyMasked: maskedKey,
        latencyMs: chatLatencyMs,
        modelTested: testModel,
        chatTest: {
          ok: true,
          status: chatRes.status,
          latencyMs: chatLatencyMs,
          reply: chatReply,
        },
        message: 'NVIDIA NIM API is connected and responding fast!',
      })
    }

    // Default: GROQ Test
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
        provider: 'groq',
        keyMasked: maskedKey,
        statusCode: modelsRes.status,
        error: `Groq API authentication failed (${modelsRes.status}): ${errText}`,
        latencyMs,
      }, { status: 200 })
    }

    const modelsData = await modelsRes.json()
    const modelIds: string[] = (modelsData.data || []).map((m: { id: string }) => m.id)

    // Test chat completion endpoint with fast model
    const chatT0 = Date.now()
    const preferredModels = ['allam-2-7b', 'qwen/qwen3.8-27b', 'llama-3.3-70b-versatile']
    const chatModel = preferredModels.find(m => modelIds.includes(m)) || modelIds[0] || 'llama-3.3-70b-versatile'

    const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: chatModel,
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
      provider: 'groq',
      keyMasked: maskedKey,
      latencyMs,
      chatTest: {
        ok: chatOk,
        status: chatRes.status,
        latencyMs: chatLatencyMs,
        reply: chatReply,
      },
      hasWhisperLarge: modelIds.includes('whisper-large-v3') || modelIds.includes('whisper-large-v3-turbo'),
      hasLlama33: modelIds.includes('llama-3.3-70b-versatile'),
      availableModelsCount: modelIds.length,
      modelTested: chatModel,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({
      success: false,
      error: `Diagnostic test error: ${message}`,
    }, { status: 500 })
  }
}
