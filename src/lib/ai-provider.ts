import { prisma } from '@/lib/prisma'

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiCompletionOptions {
  messages: AiChatMessage[]
  responseFormat?: 'json_object' | 'text'
  temperature?: number
  maxTokens?: number
  customNvidiaModel?: string
  customGroqModel?: string
  timeoutMs?: number
}

export interface AiCompletionResult {
  content: string
  provider: 'nvidia' | 'groq' | 'openai'
  model: string
  latencyMs: number
  parsedJson?: Record<string, unknown> | null
}

/**
 * Executes a Chat Completion with priority:
 * 1. NVIDIA NIM API (Primary, ultra-fast 6s timeout)
 * 2. Groq API (Instant Fallback)
 * 3. OpenAI (Tertiary Fallback if configured)
 */
export async function executeAiChatCompletion(options: AiCompletionOptions): Promise<AiCompletionResult> {
  const {
    messages,
    responseFormat = 'text',
    temperature = 0.2,
    maxTokens = 2048,
    customNvidiaModel,
    customGroqModel,
    timeoutMs = Number(process.env.AI_SCORING_TIMEOUT_MS || 15_000),
  } = options

  // 1. Fetch configured keys from DB Settings with process.env fallbacks
  let nvidiaKey = process.env.NVIDIA_API_KEY?.trim() || ''
  let groqKey = process.env.GROQ_API_KEY?.trim() || ''
  let openaiKey = process.env.OPENAI_API_KEY?.trim() || ''
  let nvidiaModel = customNvidiaModel || process.env.NVIDIA_SCORE_MODEL?.trim() || 'nvidia/nemotron-3-ultra-550b-a55b'
  let groqModel = customGroqModel || process.env.GROQ_SCORE_MODEL?.trim() || 'openai/gpt-oss-120b'

  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ['nvidia_api_key', 'groq_api_key', 'openai_api_key', 'nvidia_score_model', 'groq_score_model'],
        },
      },
    })
    for (const s of settings) {
      if (s.key === 'nvidia_api_key' && s.value?.trim()) nvidiaKey = s.value.trim()
      if (s.key === 'groq_api_key' && s.value?.trim()) groqKey = s.value.trim()
      if (s.key === 'openai_api_key' && s.value?.trim()) openaiKey = s.value.trim()
      if (s.key === 'nvidia_score_model' && s.value?.trim() && !customNvidiaModel) nvidiaModel = s.value.trim()
      if (s.key === 'groq_score_model' && s.value?.trim() && !customGroqModel) groqModel = s.value.trim()
    }
  } catch {
    // DB lookup fallback if prisma is unavailable
  }

  // Upgrade deprecated/hanging NVIDIA model IDs automatically to flagship 550B Ultra
  if (
    !nvidiaModel ||
    nvidiaModel === 'deepseek-ai/deepseek-v4.1-flash' ||
    nvidiaModel === 'meta/llama-3.3-70b-instruct' ||
    nvidiaModel === 'nvidia/llama-3.1-nemotron-70b-instruct'
  ) {
    nvidiaModel = 'nvidia/nemotron-3-ultra-550b-a55b'
  }

  // Upgrade deprecated or low-TPM Groq model IDs automatically to flagship 120B
  if (
    groqModel === 'llama-3.3-70b-versatile' ||
    groqModel === 'llama3-70b-8192' ||
    groqModel === 'qwen/qwen3.8-27b'
  ) {
    groqModel = 'openai/gpt-oss-120b'
  }

  // --- ATTEMPT 1: NVIDIA NIM API (PRIMARY STRONGEST: nvidia/nemotron-3-ultra-550b-a55b 550B ~1.7s with enable_thinking: false) ---
  if (nvidiaKey) {
    const t0 = Date.now()
    try {
      const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${nvidiaKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(Math.min(timeoutMs, 12000)),
        body: JSON.stringify({
          model: nvidiaModel,
          messages,
          temperature,
          max_tokens: maxTokens,
          chat_template_kwargs: { enable_thinking: false },
          ...(responseFormat === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
        }),
      })

      if (resp.ok) {
        const data = await resp.json()
        const msg = data.choices?.[0]?.message
        const content = msg?.content || msg?.reasoning_content || ''
        const latencyMs = Date.now() - t0
        let parsedJson = undefined
        if (responseFormat === 'json_object') {
          try {
            parsedJson = JSON.parse(content)
          } catch {}
        }
        return {
          content,
          provider: 'nvidia',
          model: nvidiaModel,
          latencyMs,
          parsedJson,
        }
      } else {
        const errText = await resp.text().catch(() => '')
        console.warn(`[AI-Provider] NVIDIA NIM (${nvidiaModel}) failed (${resp.status}): ${errText.slice(0, 150)}.`)
      }
    } catch (nvErr) {
      console.warn(`[AI-Provider] NVIDIA NIM timeout/error (${nvErr instanceof Error ? nvErr.message : 'Unknown'}).`)
    }
  }

  // --- ATTEMPT 2: GROQ API (ULTRA-FAST FALLBACK ~200-500ms: openai/gpt-oss-120b -> openai/gpt-oss-20b -> qwen/qwen3.8-27b) ---
  if (groqKey) {
    const groqCandidates = Array.from(
      new Set([groqModel, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'])
    )
    for (const candidateModel of groqCandidates) {
      const t0 = Date.now()
      try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(Math.min(timeoutMs, 10000)),
          body: JSON.stringify({
            model: candidateModel,
            messages,
            temperature,
            max_tokens: maxTokens,
            ...(responseFormat === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
          }),
        })

        if (resp.ok) {
          const data = await resp.json()
          const msg = data.choices?.[0]?.message
          const content = msg?.content || msg?.reasoning_content || ''
          const latencyMs = Date.now() - t0
          let parsedJson = undefined
          if (responseFormat === 'json_object') {
            try {
              parsedJson = JSON.parse(content)
            } catch {}
          }
          return {
            content,
            provider: 'groq',
            model: candidateModel,
            latencyMs,
            parsedJson,
          }
        } else {
          const errText = await resp.text().catch(() => '')
          console.warn(`[AI-Provider] Groq (${candidateModel}) failed (${resp.status}): ${errText.slice(0, 150)}`)
        }
      } catch (gErr) {
        console.warn(`[AI-Provider] Groq (${candidateModel}) call error:`, gErr instanceof Error ? gErr.message : gErr)
      }
    }
  }

  // --- ATTEMPT 3: OPENAI (TERTIARY FALLBACK) ---
  if (openaiKey) {
    const t0 = Date.now()
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(responseFormat === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
        }),
      })

      if (resp.ok) {
        const data = await resp.json()
        const content = data.choices?.[0]?.message?.content || ''
        const latencyMs = Date.now() - t0
        let parsedJson = undefined
        if (responseFormat === 'json_object') {
          try {
            parsedJson = JSON.parse(content)
          } catch {}
        }
        return {
          content,
          provider: 'openai',
          model: 'gpt-4o-mini',
          latencyMs,
          parsedJson,
        }
      }
    } catch (oErr) {
      console.warn(`[AI-Provider] OpenAI fallback error:`, oErr)
    }
  }

  throw new Error('All AI providers (NVIDIA NIM, Groq, OpenAI) failed or have no valid API keys configured.')
}
