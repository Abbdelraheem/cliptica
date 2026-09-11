/**
 * NOLOGY processing worker — PREMIUM pipeline
 * ============================================================
 *  yt-dlp (-N8)  →  Groq whisper-large-v3-turbo (words+segments)
 *        →  LLM scoring chain (Groq Llama70B → OpenAI → heuristics)
 *        →  [premium] InsightFace dominant-speaker tracking (sendcmd crop)
 *        →  Karaoke word-pop captions (ASS) + auto emoji
 *        →  FFmpeg 9:16 + loudnorm EBU R128  →  QC probe
 *        →  Auto-thumbnail (best face frame)  →  Cloudflare R2
 *
 * PIPELINE_PREMIUM=0 degrades gracefully to v1 center-crop everywhere.
 */
import { PrismaClient } from '@prisma/client'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, rm, writeFile, readFile, mkdir, copyFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import path from 'path'
import { calcClipCredits, calcCredits, exceedsPlanMinutes, planMaxMinutes } from './credits.mjs'
import { assertPublicHttpUrl } from './ssrf.mjs'
import { ytProxyPool, recordProxyResult, redactProxy, categorizeDownloadError } from './proxy-pool.mjs'
import { buildKaraokeAss, buildPhraseAss } from './caption-styles.mjs'

const run = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FACES_SCRIPT = path.join(__dirname, 'premium', 'faces.py')
const PYTHON_BIN =
  process.env.PYTHON_BIN ||
  (process.platform === 'win32'
    ? 'python'
    : existsSync('/opt/nology-venv/bin/python')
      ? '/opt/nology-venv/bin/python'
      : 'python3')

// Bootstrap env from the production env file so the worker is never at the
// mercy of how pm2 / shells were launched. Existing process env wins.
function loadEnvFile() {
  const file = process.env.NOLOGY_ENV_FILE ?? '/opt/nology/.env.production'
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(file)
    } catch {
      /* file absent in dev / non-prod — fall back to process env */
    }
  }
}
loadEnvFile()

const prisma = new PrismaClient()

const CFG = {
  r2Endpoint: process.env.R2_ENDPOINT,
  r2Bucket: process.env.R2_BUCKET ?? 'nology-clips',
  r2Key: process.env.R2_ACCESS_KEY_ID,
  r2Secret: process.env.R2_SECRET_ACCESS_KEY,

  groqKey: process.env.GROQ_API_KEY,
  openaiKey: process.env.OPENAI_API_KEY,
  whisperModel: process.env.WHISPER_MODEL ?? 'base',

  premium: process.env.PIPELINE_PREMIUM !== '0',
  faceFps: process.env.FACE_FPS ?? '4',
  outW: Number(process.env.OUT_W ?? 1080),
  outH: Number(process.env.OUT_H ?? 1920),
  wordsPerCard: Math.max(1, Math.min(4, Number(process.env.WORDS_PER_CARD ?? 2))),

  clipsPerVideo: Number(process.env.CLIPS_PER_VIDEO ?? 6),
  clipLength: Number(process.env.CLIP_TARGET_SECONDS ?? 38),
  renderParallel: Number(process.env.RENDER_PARALLEL ?? 4),
}

/* ------------------------------------------------------------------ */
/* DB-first runtime config                                            */
/* The admin Settings panel writes to the `Setting` table. These      */
/* knobs resolve Setting > process.env > default so the panel is real. */
/* ------------------------------------------------------------------ */

const ENV_DEFAULTS = {
  pipeline_premium: process.env.PIPELINE_PREMIUM !== '0',
  clips_per_video: Number(process.env.CLIPS_PER_VIDEO ?? 6),
  clip_target_seconds: Number(process.env.CLIP_TARGET_SECONDS ?? 38),
  render_parallel: Number(process.env.RENDER_PARALLEL ?? 4),
  stale_job_minutes: Number(process.env.STALE_JOB_MINUTES ?? 30),
}

const SETTING_PARSE = {
  pipeline_premium: (v) => v === 'true',
  clips_per_video: (v) => Math.max(1, Number(v) || 6),
  clip_target_seconds: (v) => Math.max(5, Number(v) || 38),
  render_parallel: (v) => Math.max(1, Math.min(8, Number(v) || 4)),
  stale_job_minutes: (v) => Math.max(1, Number(v) || 30),
  groq_api_key: (v) => String(v || '').trim(),
  openai_api_key: (v) => String(v || '').trim(),
  whisper_model: (v) => String(v || '').trim(),
}

let configCache = null
let configCacheAt = 0

async function refreshConfig() {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: Object.keys(SETTING_PARSE) } } })
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    const merged = { ...ENV_DEFAULTS }
    for (const [k, parse] of Object.entries(SETTING_PARSE)) {
      if (rows.some((r) => r.key === k)) merged[k] = parse(map[k])
    }
    configCache = merged
    configCacheAt = Date.now()
  } catch (e) {
    console.error('[worker] config refresh failed (using last-known):', e.message)
  }
}

async function cfg() {
  if (!configCache || Date.now() - configCacheAt > 60_000) await refreshConfig()
  return configCache ?? ENV_DEFAULTS
}

/** Push DB-backed knobs into the live CFG object (mutated in place). */
async function syncConfigInto() {
  const c = await cfg()
  CFG.premium = c.pipeline_premium
  CFG.clipsPerVideo = c.clips_per_video
  CFG.clipLength = c.clip_target_seconds
  CFG.renderParallel = c.render_parallel
  if (c.groq_api_key) CFG.groqKey = c.groq_api_key
  if (c.openai_api_key) CFG.openaiKey = c.openai_api_key
  if (c.whisper_model) CFG.whisperModel = c.whisper_model
}

async function sh(cmd, args, opts) {
  const { stdout } = await run(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...opts })
  return stdout
}

/** Base yt-dlp args: JS runtimes (deno preferred — solves YouTube's n challenge), mandatory impersonate
 * (server IP is a flagged AWS datacenter; faking a real browser TLS fingerprint is what gets past the
 * "Sign in to confirm you're not a bot" wall), plus optional cookies file / proxy given via extra. */
function ytdlpArgs(extra) {
  const args = ['--js-runtimes', 'node', '--js-runtimes', 'deno', '--impersonate', 'Safari-18.4']
  if (process.env.YTDLP_COOKIES) args.push('--cookies', process.env.YTDLP_COOKIES)
  return args.concat(extra)
}

/* ================= stages ================= */

async function download(url, dir) {
  await assertPublicHttpUrl(url)
  const out = path.join(dir, 'source.%(ext)s')

  const attempt = (proxy) =>
    sh(
      '/opt/nology-venv/bin/yt-dlp',
      ytdlpArgs([
        ...(proxy ? ['--proxy', proxy] : []),
        '--socket-timeout',
        '20',
        '-N',
        '8',
        '-f',
        'bv*[height<=1080]+ba/b[height<=1080]/b',
        '--merge-output-format',
        'mp4',
        '--max-filesize',
        '2.5G',
        '--match-filter',
        'duration <= 7200',
        '-o',
        out,
        url,
      ]),
      { timeout: 1000 * 60 * 10 }
    )

  // Direct first — most stable when YouTube isn't flagging the IP.
  const t0 = Date.now()
  try {
    await attempt(null)
    const dur = Date.now() - t0
    console.log(`[worker:download] proxy=direct duration_ms=${dur} outcome=success`)
    return await findFile(dir, /^source\./)
  } catch (e) {
    const dur = Date.now() - t0
    const errType = categorizeDownloadError(e)
    console.warn(
      `[worker:download] proxy=direct duration_ms=${dur} outcome=failure error_type=${errType} error="${e.message
        .split('\n')[0]
        .slice(0, 100)}" — trying proxies`
    )
  }

  // Rotate the prioritized proxy pool. Success is authoritative; on failure
  // keep the last non-network error (bot-wall etc.) for the job report.
  let lastErr = null
  const proxies = await ytProxyPool()
  for (const proxy of proxies) {
    const pStart = Date.now()
    const redacted = redactProxy(proxy)
    try {
      await attempt(proxy)
      const dur = Date.now() - pStart
      recordProxyResult(proxy, true)
      console.log(`[worker:download] proxy=${redacted} duration_ms=${dur} outcome=success`)
      return await findFile(dir, /^source\./)
    } catch (e) {
      lastErr = e
      const dur = Date.now() - pStart
      const errType = categorizeDownloadError(e)
      recordProxyResult(proxy, false, e.message)
      console.warn(
        `[worker:download] proxy=${redacted} duration_ms=${dur} outcome=failure error_type=${errType} error="${e.message
          .split('\n')[0]
          .slice(0, 100)}"`
      )
    }
  }
  throw lastErr ?? new Error('all download paths failed')
}

/** Uploaded files live in R2 — pull them with the same AWS creds. */
async function downloadFromR2(key, dir) {
  const out = path.join(dir, 'source.mp4')
  await sh('aws', ['s3', 'cp', `s3://${CFG.r2Bucket}/${key}`, out, '--endpoint-url', CFG.r2Endpoint], {
    env: { ...process.env, AWS_ACCESS_KEY_ID: CFG.r2Key, AWS_SECRET_ACCESS_KEY: CFG.r2Secret, AWS_DEFAULT_REGION: 'auto' },
    timeout: 1000 * 60 * 20,
  })
  return out
}

async function findFile(dir, re) {
  const fs = await import('fs/promises')
  for (const f of await fs.readdir(dir)) if (re.test(f)) return path.join(dir, f)
  throw new Error(`file not found: ${re}`)
}

async function probeDuration(file) {
  const out = await sh('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', file])
  return parseFloat(JSON.parse(out).format.duration)
}

/**
 * Cheap pre-download duration probe via yt-dlp metadata (no media fetched).
 * Returns seconds, or null when the URL doesn't report one (then we proceed
 * to download and probe the file as usual).
 */
async function probeUrlDuration(url) {
  await assertPublicHttpUrl(url)
  try {
    const out = await sh(
      '/opt/nology-venv/bin/yt-dlp',
      ytdlpArgs([
        '--socket-timeout',
        '20',
        '-f',
        'bv*[height<=1080]+ba/b[height<=1080]/b',
        '--print',
        'duration',
        '--no-download',
        url,
      ]),
      { timeout: 1000 * 60 * 2 }
    )
    const v = parseFloat(out.trim())
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

/* ---------- transcription ---------- */

async function extractAudio(file, dir) {
  const mp3 = path.join(dir, 'audio.mp3')
  await sh('ffmpeg', ['-y', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', mp3], {
    timeout: 1000 * 60 * 10,
  })
  return mp3
}

async function transcribeGroq(mp3, language) {
  const form = new FormData()
  form.append('file', new Blob([await readFile(mp3)]), 'audio.mp3')
  form.append('model', 'whisper-large-v3-turbo')
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')
  form.append('timestamp_granularities[]', 'word')
  if (language && language !== 'auto') form.append('language', language) // force — fixes Arabic→English mixups
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CFG.groqKey}` },
    body: form,
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const d = await res.json()
  return {
    language: d.language ?? 'en',
    segments: (d.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: (s.text ?? '').trim() })),
    words: (d.words ?? []).map((w) => ({ start: w.start, end: w.end, text: (w.word ?? '').trim() })),
  }
}

async function transcribeLocal(file, dir) {
  const jsonPath = path.join(dir, 'transcript.json')
  await sh('/opt/nology-venv/bin/python', [
    '-c', `
import sys, json
from faster_whisper import WhisperModel
m = WhisperModel(${JSON.stringify(CFG.whisperModel)}, device="cpu", compute_type="int8")
segs, info = m.transcribe(sys.argv[1], word_timestamps=True)
out, words = [], []
for s in segs:
    out.append({"start": s.start, "end": s.end, "text": s.text.strip()})
    for w in (s.words or []):
        words.append({"start": w.start, "end": w.end, "text": (w.word or "").strip()})
json.dump({"language": info.language, "segments": out, "words": words}, open(sys.argv[2], "w"))
`, file, jsonPath,
  ], { timeout: 1000 * 60 * 45 })
  return JSON.parse(await readFile(jsonPath, 'utf8'))
}

async function transcribe(file, dir, language = 'auto') {
  try {
    if (CFG.groqKey) {
      const t0 = Date.now()
      const mp3 = await extractAudio(file, dir)
      const r = await transcribeGroq(mp3, language)
      console.log(`[worker] Groq transcription done in ${((Date.now() - t0) / 1000).toFixed(0)}s (${r.words.length} words, lang=${language})`)
      return r
    }
  } catch (e) {
    console.error('[worker] Groq failed, falling back to local whisper:', e.message)
  }
  try {
    return await transcribeLocal(file, dir)
  } catch (e) {
    console.error('[worker] Local whisper failed (audio-only or no audio stream):', e.message)
    return { language: language === 'auto' ? 'en' : language, segments: [], words: [] }
  }
}

/* ---------- scoring ---------- */

/**
 * Semantic & pause-aware candidate generation.
 * Groups whisper segments by natural sentence endings (. ? ! ؟ …) or silence gaps (>0.6s),
 * ensuring every clip starts with a clean sentence (hook) and ends on a completed thought
 * without cutting words or sentences in half.
 */
function generateCandidateMoments(transcript, duration, from = 0, targetLen = 38) {
  const minDur = Math.max(20, Math.round(targetLen * 0.65))
  const maxDur = Math.min(75, Math.round(targetLen * 1.45))
  const segs = (transcript.segments ?? []).filter((s) => s.start >= Math.max(0, from - 2))

  if (!segs.length) {
    // Time-based fallback when transcript has no segments
    const win = targetLen
    const fallback = []
    for (let s = Math.max(0, from); s + win <= duration && fallback.length < 50; s += win / 2) {
      fallback.push({ start: Math.round(s), end: Math.round(s + win), text: '' })
    }
    return fallback
  }

  // Detect sentence or thought boundary
  const isBoundary = (idx) => {
    if (idx >= segs.length - 1) return true
    const text = (segs[idx].text || '').trim()
    const endsWithPunct = /[.?!؟…]$/.test(text)
    const gap = segs[idx + 1].start - segs[idx].end
    return endsWithPunct || gap >= 0.6
  }

  const candidates = []
  const usedRanges = []

  // Step through segment by segment
  for (let i = 0; i < segs.length && candidates.length < 50; i++) {
    const startSeg = segs[i]
    if (startSeg.start < from) continue

    let accumulatedText = []
    let clipStart = startSeg.start
    let clipEnd = startSeg.end

    for (let j = i; j < segs.length; j++) {
      accumulatedText.push(segs[j].text.trim())
      clipEnd = segs[j].end
      const currentDur = clipEnd - clipStart

      if (currentDur >= minDur) {
        if (isBoundary(j) || currentDur >= maxDur) {
          const fullText = accumulatedText.join(' ').trim()
          const wordCount = fullText.split(/\s+/).filter(Boolean).length

          // Avoid dead silence or tiny blips
          if (wordCount >= 18) {
            const overlap = usedRanges.some(
              (r) => Math.abs(r.start - clipStart) < 12 && Math.abs(r.end - clipEnd) < 12
            )
            if (!overlap) {
              candidates.push({
                start: Math.round(clipStart),
                end: Math.round(clipEnd),
                text: fullText,
              })
              usedRanges.push({ start: clipStart, end: clipEnd })
            }
          }
          break
        }
      }
    }
  }

  // Fallback if semantic grouping produced too few candidates
  if (candidates.length < 3) {
    const win = targetLen
    for (let s = Math.max(0, from); s + win < duration && candidates.length < 40; s += win / 2) {
      const text = segs
        .filter((x) => x.start >= s - 1 && x.end <= s + win + 1)
        .map((x) => x.text)
        .join(' ')
        .trim()
      if (text.split(/\s+/).length > 20) {
        candidates.push({ start: Math.round(s), end: Math.round(s + win), text })
      }
    }
  }

  return candidates
}

async function llmScoreMoments(candidates, instructions) {
  const providers = []
  if (CFG.groqKey)
    providers.push({ name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: CFG.groqKey, model: process.env.GROQ_SCORE_MODEL ?? 'llama-3.3-70b-versatile' })
  if (CFG.openaiKey)
    providers.push({ name: 'openai', url: 'https://api.openai.com/v1/chat/completions', key: CFG.openaiKey, model: 'gpt-4o-mini' })

  let system =
    'You are a master viral video editor for TikTok, Instagram Reels, and YouTube Shorts. ' +
    'Analyze the provided speech moments (which may be in Arabic, English, or mixed) and evaluate their virality.\n' +
    'For each moment evaluate three distinct sub-scores from 0 to 100:\n' +
    '- hookScore: Power of the first 3 seconds to halt scrolling (provocative question, shocking statement, mystery, or curiosity gap).\n' +
    '- retentionScore: Pacing, storytelling flow, and lack of fluff that keeps viewers watching until the end.\n' +
    '- shareScore: Relatability, quote-worthiness, surprising value, or emotional impact.\n' +
    '- score: Overall weighted viral potential (0-100).\n' +
    'If the candidate text is in Arabic, write the "title" (3-6 words) and "reason" in Arabic. ' +
    'Return strict JSON {"moments":[{"index":<int>,"score":<0-100>,"hookScore":<0-100>,"retentionScore":<0-100>,"shareScore":<0-100>,"title":"<=6 punchy words",' +
    '"reason":"one sentence why it performs","emoji":"one fitting emoji"}]}. ' +
    `Return exactly the ${CFG.clipsPerVideo} strongest moments, best first.`
  if (instructions?.trim()) {
    system += ` The uploader added these instructions — follow them strictly when picking and ranking: "${instructions.trim().slice(0, 500)}"`
  }

  for (const p of providers) {
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          model: p.model,
          response_format: { type: 'json_object' },
          temperature: 0.3,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: JSON.stringify(candidates.map((c, i) => ({ index: i, text: c.text.slice(0, 700) }))) },
          ],
        }),
      })
      if (!res.ok) throw new Error(`${p.name} ${res.status}`)
      const data = await res.json()
      const parsed = JSON.parse(data.choices[0].message.content)
      const valid = (parsed.moments ?? [])
        .filter((m) => Number.isInteger(m.index) && candidates[m.index])
        .map((m) => ({
          ...candidates[m.index],
          score: Math.max(0, Math.min(100, Math.round(m.score))),
          hookScore: Math.max(0, Math.min(100, Math.round(m.hookScore ?? m.score))),
          retentionScore: Math.max(0, Math.min(100, Math.round(m.retentionScore ?? m.score))),
          shareScore: Math.max(0, Math.min(100, Math.round(m.shareScore ?? m.score))),
          title: String(m.title ?? '').slice(0, 80),
          reason: String(m.reason ?? ''),
          emoji: String(m.emoji ?? '').slice(0, 4),
        }))
      if (valid.length) return valid.slice(0, CFG.clipsPerVideo)
    } catch (e) {
      console.error(`[worker] scoring via ${p.name} failed:`, e.message)
    }
  }
  return null
}

function heuristicScoreMoments(candidates) {
  const AR_HOOKS = /\b(سر|أسرار|غلطة|أكبر غلطة|كارثة|إياك|انتبه|احذر|لا تسوي|لا تعمل|حقيقة|صدمة|نصيحة|سري|خطير|ليش|لماذا|كيف|هل تعلم|شو السبب|ما هو|تخيل|فكرك|مين|متى|بتعرف|أغرب|عجيب|مليون|ملايين|آلاف|ألف|أضعاف|بالمية|فجأة|اللي صار|المشكلة|الحل|اكتشفت|تعلمت|قصة|النتيجة)\b/ui
  const EN_HOOKS = /\b(secret|never|nobody|mistake|million|billion|why|how|what if|imagine|did you know|best|worst|stop|truth|exposed|warning|danger|actually|suddenly|problem|solution|discovered|story|first time)\b/gi

  return candidates
    .map((c) => {
      const text = c.text || ''
      const dur = Math.max(15, c.end - c.start)
      const words = text.split(/\s+/).filter(Boolean)
      const wordCount = words.length
      const wps = wordCount / dur // words per second

      // 1. Hook score (0-100): opening power in first 15 words
      const firstSlice = words.slice(0, 15).join(' ')
      const hasOpeningQ = firstSlice.includes('?') || firstSlice.includes('؟')
      const hasOpeningEx = firstSlice.includes('!')
      const arHookCount = (text.match(AR_HOOKS) || []).length
      const enHookCount = (text.match(EN_HOOKS) || []).length
      const hookCount = arHookCount + enHookCount
      const openingHook = (firstSlice.match(AR_HOOKS) || []).length + (firstSlice.match(EN_HOOKS) || []).length

      let hookScore = 50 + (hookCount * 7) + (openingHook * 15) + (hasOpeningQ ? 16 : 0) + (hasOpeningEx ? 8 : 0)
      hookScore = Math.min(99, Math.max(40, Math.round(hookScore)))

      // 2. Retention score (0-100): cadence, energy, clean ending
      let paceBonus = 0
      if (wps >= 2.0 && wps <= 3.6) paceBonus = 18
      else if (wps >= 1.5 && wps < 2.0) paceBonus = 8
      else if (wps > 3.6 && wps <= 4.5) paceBonus = 10

      const endsCleanly = /[.!?؟]$/.test(text.trim())
      let retentionScore = 46 + paceBonus + (endsCleanly ? 12 : 0) + Math.min(18, Math.round(wordCount * 0.18))
      retentionScore = Math.min(98, Math.max(38, Math.round(retentionScore)))

      // 3. Shareability score (0-100): curiosity, numbers, facts
      const hasNumbers = /\d+|مليون|آلاف|ألف|million|billion|10x|%/.test(text)
      let shareScore = 44 + (hookCount * 6) + (hasNumbers ? 15 : 0) + (hasOpeningQ ? 10 : 0)
      shareScore = Math.min(97, Math.max(35, Math.round(shareScore)))

      const overallScore = Math.round(hookScore * 0.42 + retentionScore * 0.35 + shareScore * 0.23)

      let title = words.slice(0, 6).join(' ')
      if (hasOpeningQ) {
        const qPart = text.split(/[?؟]/)[0]
        if (qPart && qPart.length < 50) title = qPart.trim() + '؟'
      }

      return {
        ...c,
        score: overallScore,
        hookScore,
        retentionScore,
        shareScore,
        title: title.slice(0, 60),
        reason:
          hookCount > 0
            ? (arHookCount > 0
                ? 'مقطع مشوق يحتوي على خطاف قوي ومحتوى تفاعلي عالي'
                : 'High-engagement viral hook with strong narrative pacing')
            : 'Cohesive thought unit with continuous speech density',
        emoji: arHookCount > 0 ? '🔥' : '⚡',
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, CFG.clipsPerVideo)
}

async function scoreMoments(transcript, duration, from = 0, instructions = null) {
  const candidates = generateCandidateMoments(transcript, duration, from, CFG.clipLength)
  if (!candidates.length) return []
  return (await llmScoreMoments(candidates, instructions)) ?? heuristicScoreMoments(candidates)
}

/* ---------- premium vision ---------- */

/** Dominant-speaker crop path via InsightFace + OpenCV + Avatar motion fallback. Returns null on any failure. */
async function faceTrack(src, moment, dir, idx) {
  if (!CFG.premium) return null
  const outJson = path.join(dir, `faces${idx}.json`)
  try {
    await sh(PYTHON_BIN, [FACES_SCRIPT, 'track', src, String(moment.start), String(moment.end), outJson], {
      timeout: 1000 * 60 * 10,
      env: { ...process.env, FACE_FPS: CFG.faceFps, OUT_W: String(CFG.outW), OUT_H: String(CFG.outH) },
    })
    const data = JSON.parse(await readFile(outJson, 'utf8'))
    return data.commands?.length ? data : null
  } catch (e) {
    console.error(`[worker] faceTrack failed (center-crop fallback): ${e.message}`)
    return null
  }
}

/* ---------- captions ---------- */
// Preset styles & ASS generation are imported from ./caption-styles.mjs

/* ---------- AI motion graphics ---------- */

async function llmMotionPackages(moments) {
  const providers = []
  if (CFG.groqKey)
    providers.push({ name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: CFG.groqKey, model: process.env.GROQ_SCORE_MODEL ?? 'llama-3.3-70b-versatile' })
  if (CFG.openaiKey)
    providers.push({ name: 'openai', url: 'https://api.openai.com/v1/chat/completions', key: CFG.openaiKey, model: 'gpt-4o-mini' })

  const system =
    'You are a motion-graphics director for vertical short-form videos (TikTok/Reels/Shorts). ' +
    'For each moment design the opening title card: a scroll-stopping headline and one supporting kicker line. ' +
    'Return strict JSON {"packs":[{"index":<int>,"headline":"<=24 chars, UPPERCASE, punchy hook",' +
    '"kicker":"<=34 chars supporting line, sentence case"}]}.'

  for (const p of providers) {
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          model: p.model,
          response_format: { type: 'json_object' },
          temperature: 0.6,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: JSON.stringify(moments.map((m, i) => ({ index: i, topic: m.title, text: m.text.slice(0, 280) }))) },
          ],
        }),
      })
      if (!res.ok) throw new Error(`${p.name} ${res.status}`)
      const data = await res.json()
      const parsed = JSON.parse(data.choices[0].message.content)
      const packs = (parsed.packs ?? [])
        .filter((pk) => Number.isInteger(pk.index) && moments[pk.index])
        .map((pk) => ({
          index: pk.index,
          headline: String(pk.headline ?? '').toUpperCase().replace(/["'\\]/g, '').slice(0, 26),
          kicker: String(pk.kicker ?? '').replace(/["'\\]/g, '').slice(0, 36),
        }))
      if (packs.length) return packs
    } catch (e) {
      console.error(`[worker] motion packs via ${p.name} failed:`, e.message)
    }
  }
  return null
}

function heuristicMotionPack(moment) {
  return {
    index: moment.index ?? 0,
    headline: (moment.title || 'Watch this').toUpperCase().replace(/["'\\]/g, '').slice(0, 26),
    kicker: moment.emoji ? `${moment.emoji} must watch` : 'must watch',
  }
}

/* ---------- render ---------- */

async function renderClip(src, moment, dir, idx, transcript, mode = 'smart', motion = null, captionStyle = 'hormozi', aspectRatio = '9:16') {
  let W = CFG.outW, H = CFG.outH
  if (aspectRatio === '1:1') {
    W = 1080
    H = 1080
  } else if (aspectRatio === '16:9') {
    W = 1920
    H = 1080
  }
  const targetDur = moment.end - moment.start

  // captions
  const assPath = path.join(dir, `cap${idx}.ass`)
  const karaoke = buildKaraokeAss(transcript.words ?? [], moment.start, moment.end, moment.emoji, captionStyle, W, H)
  await writeFile(assPath, karaoke ?? buildPhraseAss(moment.text, moment.start, moment.end, captionStyle, W, H))
  const escAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:')

  // face-tracked crop commands
  const wantsFace = mode === 'smart' || mode === 'face'
  const faces = wantsFace ? await faceTrack(src, moment, dir, idx) : null
  let cmdPath = null
  let cropW, cropH
  if (faces?.win) {
    ;[cropW, cropH] = faces.win
  } else {
    const p = await probeSize(src)
    cropW = Math.round(Math.min(p.w, p.h * W / H))
    cropH = Math.round(cropW * H / W)
  }
  if (faces) {
    cmdPath = path.join(dir, `cmds${idx}.txt`)
    await writeFile(
      cmdPath,
      faces.commands.map(([t, k, v]) => `${t.toFixed(2)} crop ${k} ${Math.round(v)};`).join('\n')
    )
  }

  // framing filters (cliptica-style modes)
  const centerCrop = `crop='min(iw,ih*${W}/${H})':'min(ih,iw*${H}/${W})'`
  const faceCrop = cmdPath
    ? `sendcmd=f='${cmdPath.replace(/\\/g, '/').replace(/:/g, '\\:')}',crop=${cropW}:${cropH}:x:y`
    : centerCrop

  let vfCore
  switch (mode) {
    case 'blur':
      // original framing kept, bars filled with a soft blurred copy of the shot
      vfCore = `split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=28[bgb];[b]scale=${W}:-2[fg];[bgb][fg]overlay=(W-w)/2:(H-h)/2`
      break
    case 'letter':
      // full original frame on clean black — room for a big headline
      vfCore = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black`
      break
    case 'center':
      vfCore = centerCrop
      break
    case 'face':
    case 'smart':
    default:
      vfCore = faceCrop
  }

  const escPath = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:')
  const font = process.env.MOTION_FONT ?? '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
  let motionLayer = null
  if (motion?.headline) {
    const headlineFile = path.join(dir, `head${idx}.txt`)
    const kickerFile = path.join(dir, `kick${idx}.txt`)
    await writeFile(headlineFile, motion.headline)
    await writeFile(kickerFile, motion.kicker || '')
    const D = targetDur.toFixed(2)
    const fsBig = Math.round(H * 0.042)
    const fsSmall = Math.round(H * 0.024)
    const entranceY = `'${H}*0.068+${H}*0.05*(1-min(1\\,max(0\\,(t-0.15)/0.55)))'`
    motionLayer =
      `drawtext=fontfile='${font}':textfile='${escPath(headlineFile)}':fontsize=${fsBig}` +
      `:fontcolor=white:borderw=${Math.max(3, Math.round(H / 480))}:bordercolor=black@0.6` +
      `:shadowcolor=black@0.45:shadowx=4:shadowy=4` +
      `:x=(w-text_w)/2:y=${entranceY}:alpha='clip((t-0.15)/0.5\\,0\\,1)'` +
      `,drawtext=fontfile='${font}':textfile='${escPath(kickerFile)}':fontsize=${fsSmall}` +
      `:fontcolor=white@0.92:borderw=${Math.max(2, Math.round(H / 700))}:bordercolor=black@0.5` +
      `:x=(w-text_w)/2:y=${H * 0.128}:alpha='clip((t-0.5)/0.5\\,0\\,1)'` +
      `,drawtext=fontfile='${font}':text='Follow for more':fontsize=${fsSmall}` +
      `:fontcolor=white:borderw=${Math.max(2, Math.round(H / 700))}:bordercolor=black@0.55` +
      `:x=(w-text_w)/2:y=h*0.82:alpha='if(lt(t\\,${D}-1.4)\\,0\\,clip((${D}-t)/0.9\\,0\\,1))'`
  }

  const buildArgs = (usePrimary) => {
    const baseChain = `${usePrimary ? vfCore : centerCrop},scale=${W}:${H},subtitles=${escAss}`
    if (!motionLayer) {
      return [
        '-y', '-ss', String(moment.start), '-t', String(targetDur), '-i', src,
        '-vf', baseChain,
        '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
        '-c:v', 'libx264', '-preset', 'superfast', '-crf', '22',
        '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
      ]
    }
    // AI motion pass: title card + kicker + end CTA + animated progress bar
    const D = targetDur.toFixed(2)
    return [
      '-y', '-ss', String(moment.start), '-t', String(targetDur), '-i', src,
      '-f', 'lavfi', '-i', `color=c=white@0.20:s=${W}x10:r=30:d=${D}`,
      '-f', 'lavfi', '-i', `color=c=0xFF7A3D:s=${W}x10:r=30:d=${D}`,
      '-filter_complex',
      `[0:v]${baseChain},${motionLayer}[base];` +
        `[base][1:v]overlay=x=0:y=${H - 26}:eof_action=repeat[tr];` +
        `[2:v]crop=w='iw*min(1\\,t/${D})':h=ih:x=0:y=0[fill];` +
        `[tr][fill]overlay=x=0:y=${H - 26}:eof_action=repeat[vout]`,
      '-map', '[vout]', '-map', '0:a?',
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
      '-c:v', 'libx264', '-preset', 'superfast', '-crf', '22',
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
    ]
  }

  const outFile = path.join(dir, `clip${idx}.mp4`)
  await sh('ffmpeg', [...buildArgs(true), '-strict', '-2', outFile].map((a) => a), { timeout: 1000 * 60 * 20 })

  // QC: duration must match ±0.75s, else one retry with plain center crop
  const gotDur = await probeDuration(outFile)
  if (Math.abs(gotDur - targetDur) > 0.75) {
    console.warn(`[worker] QC duration off (${gotDur.toFixed(2)} vs ${targetDur}) — retrying center-crop`)
    await sh('ffmpeg', [...buildArgs(false), outFile], { timeout: 1000 * 60 * 20 })
  }

  // thumbnail (best face frame when tracked, else +3s in)
  // faces.thumb_ts and moment.start are ABSOLUTE source timestamps, but the
  // seek below reads the rendered CLIP (relative 0) — so both must be offset
  // by moment.start, else the seek lands past EOF and produces a blank frame.
  const thumbTs = faces?.thumb_ts != null ? Math.max(0, faces.thumb_ts - moment.start) : 3
  const thumbPath = path.join(dir, `thumb${idx}.jpg`)
  await sh('ffmpeg', ['-y', '-ss', String(thumbTs), '-i', outFile, '-frames:v', '1', '-q:v', '2', thumbPath])

  return { file: outFile, thumb: thumbPath, cropMode: faces ? 'face-track' : 'center', motion: motion ? { mode: 'ai-motion', headline: motion.headline, kicker: motion.kicker } : null }
}

let srcProbeCache = null
async function probeSize(file) {
  if (srcProbeCache) return srcProbeCache
  const out = await sh('ffprobe', ['-v', 'quiet', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file])
  const s = JSON.parse(out).streams[0]
  srcProbeCache = { w: s.width, h: s.height }
  return srcProbeCache
}

/** Render all clips with bounded parallelism. */
async function renderAll(src, moments, dir, transcript, framing = 'smart', pkgs = null, captionStyle = 'hormozi', aspectRatio = '9:16') {
  const VARIETY = ['face', 'blur', 'center']
  const results = new Array(moments.length)
  let next = 0
  async function lane() {
    for (;;) {
      const i = next++
      if (i >= moments.length) return
      const mode = framing === 'variety' ? VARIETY[i % VARIETY.length] : framing
      console.log(`[worker] rendering clip ${i + 1}/${moments.length} [${mode}${pkgs?.[i] ? ' +motion' : ''}, style=${captionStyle}, ratio=${aspectRatio}]`)
      results[i] = await renderClip(src, moments[i], dir, i, transcript, mode, pkgs?.[i] ?? null, captionStyle, aspectRatio)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CFG.renderParallel, moments.length) }, lane))
  return results
}

/* ---------- storage ---------- */

async function uploadToR2(file, key, contentType = 'video/mp4') {
  await sh('aws', ['s3', 'cp', file, `s3://${CFG.r2Bucket}/${key}`, '--endpoint-url', CFG.r2Endpoint, '--content-type', contentType], {
    env: { ...process.env, AWS_ACCESS_KEY_ID: CFG.r2Key, AWS_SECRET_ACCESS_KEY: CFG.r2Secret, AWS_DEFAULT_REGION: 'auto' },
    timeout: 1000 * 60 * 15,
  })
  return `${CFG.r2Endpoint}/${CFG.r2Bucket}/${key}`
}

/* ================= job loop ================= */

/**
 * Early, cheap gate: probe the URL's duration via yt-dlp metadata and reject
 * an out-of-plan source BEFORE downloading the media. The authoritative
 * post-download check still runs (file uploads and live/misreported URLs
 * rely on it), so this only saves bandwidth/disk on the common reject path.
 */
async function ensureWithinPlan(project) {
  const preDur = await probeUrlDuration(project.sourceUrl)
  if (!preDur) return
  const owner = await prisma.user.findUnique({ where: { id: project.userId }, select: { role: true } })
  if (exceedsPlanMinutes(preDur / 60, owner?.role)) {
    throw new Error(
      `Source is ~${Math.round(preDur / 60)} min — exceeds the ${planMaxMinutes(owner?.role)} min limit for the ${owner?.role ?? 'FREE'} plan (pre-download check)`
    )
  }
}

async function processClipAdjust(job) {
  const setP = (p, stage = null) =>
    prisma.processingJob.update({
      where: { id: job.id },
      data: {
        progress: p,
        ...(stage ? { result: { ...(job.result || {}), stage } } : {}),
      },
    }).catch(() => {})

  const { clipId, start, end, captionStyle: reqStyle } = job.result || {}
  if (!clipId || start == null || end == null) {
    throw new Error('Invalid clip adjust parameters')
  }

  const project = await prisma.project.findUnique({ where: { id: job.projectId } })
  if (!project) throw new Error(`Project ${job.projectId} not found`)

  const clip = await prisma.clip.findUnique({ where: { id: clipId } })
  if (!clip) throw new Error(`Clip ${clipId} not found`)

  console.log(`[worker] [clip_adjust] ${job.id}: adjusting clip ${clipId} to [${start}s, ${end}s]`)
  await setP(10, 'Initializing clip re-trim workspace...')

  const dir = await mkdtemp(path.join(tmpdir(), 'nology-adj-'))
  try {
    // 1. Acquire source video: check persistent cache first, else download
    const cacheDir = path.join(tmpdir(), 'nology-sources')
    await mkdir(cacheDir, { recursive: true }).catch(() => {})
    const cachedSrc = path.join(cacheDir, `${project.id}.mp4`)

    let src = null
    try {
      const st = await stat(cachedSrc)
      if (st.size > 1000) {
        console.log(`[worker] [clip_adjust] using cached source video: ${cachedSrc}`)
        src = cachedSrc
      }
    } catch {
      // not in cache
    }

    if (!src) {
      console.log(`[worker] [clip_adjust] fetching source (${project.sourceFile ? 'upload' : 'url'})`)
      await setP(20, 'Loading source video media...')
      src = project.sourceFile
        ? await downloadFromR2(project.sourceFile, dir)
        : await download(project.sourceUrl, dir)

      // save to cache for subsequent adjustments
      await copyFile(src, cachedSrc).catch(() => {})
    }

    await setP(40, 'Aligning transcript timing & karaoke subtitles...')

    // 2. Transcript words: read from cached project.transcript or clip.captionData
    let transcript = project.transcript
    if (!transcript || !Array.isArray(transcript.words)) {
      if (clip.captionData && Array.isArray(clip.captionData.words)) {
        transcript = { words: clip.captionData.words }
      } else {
        transcript = { words: [] }
      }
    }

    const captionStyle = reqStyle || clip.captionStyle || project.captionStyle || 'hormozi'
    const moment = {
      start,
      end,
      title: clip.title,
      text: clip.title,
      emoji: clip.captionData?.emoji || '',
      score: clip.viralScore,
    }

    console.log(`[worker] [clip_adjust] rendering clip ${clipId} [${start}s-${end}s, style=${captionStyle}]`)
    await setP(60, 'Re-rendering adjusted clip & subtitle burn-in...')

    const motion = clip.motionGraphics?.mode === 'ai-motion' ? clip.motionGraphics : null
    const aspectRatio = project.aspectRatio ?? '9:16'
    const rendered = await renderClip(
      src,
      moment,
      dir,
      `adj_${Date.now()}`,
      transcript,
      project.framing ?? 'smart',
      motion,
      captionStyle,
      aspectRatio
    )

    await setP(85, 'Uploading adjusted clip to Cloudflare R2...')
    console.log(`[worker] [clip_adjust] uploading adjusted clip to R2`)

    const base = `${project.userId}/${project.id}`
    const timestamp = Date.now()
    const url = await uploadToR2(rendered.file, `${base}/clip-${clip.id}-adj-${timestamp}.mp4`)
    const thumbUrl = await uploadToR2(rendered.thumb, `${base}/thumb-${clip.id}-adj-${timestamp}.jpg`, 'image/jpeg')

    const winWords = (transcript.words ?? []).filter((w) => w.end > start && w.start < end)

    await prisma.clip.update({
      where: { id: clip.id },
      data: {
        sourceStart: Math.round(start),
        sourceEnd: Math.round(end),
        duration: Math.round(end - start),
        status: 'READY',
        videoUrl: url,
        exportUrl: url,
        thumbnailUrl: thumbUrl,
        captionStyle,
        captionData: {
          mode: 'karaoke',
          emoji: moment.emoji ?? '',
          words: winWords,
          style: captionStyle,
        },
      },
    })

    console.log(`[worker] [clip_adjust] clip ${clipId} updated successfully to [${start}s-${end}s]`)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

async function processJob(job) {
  if (job.type === 'clip_adjust') {
    return processClipAdjust(job)
  }

  const project = await prisma.project.findUnique({ where: { id: job.projectId } })
  if (!project || (!project.sourceUrl && !project.sourceFile)) throw new Error('project has no source')

  const setP = (p, stage = null) =>
    prisma.processingJob.update({
      where: { id: job.id },
      data: {
        progress: p,
        ...(stage ? { result: { ...(job.result || {}), stage } } : {}),
      },
    }).catch(() => {})

  await prisma.project.update({ where: { id: project.id }, data: { status: 'PROCESSING' } })

  const dir = await mkdtemp(path.join(tmpdir(), 'nology-'))
  try {
    console.log(`[worker] ${job.id}: fetching source (${project.sourceFile ? 'upload' : 'youtube'})`)
    await setP(8, 'Fetching video source media...')
    const src = project.sourceFile
      ? await downloadFromR2(project.sourceFile, dir)
      : (await ensureWithinPlan(project), await download(project.sourceUrl, dir))

    // Cache source video for fast subsequent clip adjustments
    try {
      const cacheDir = path.join(tmpdir(), 'nology-sources')
      await mkdir(cacheDir, { recursive: true })
      await copyFile(src, path.join(cacheDir, `${project.id}.mp4`))
    } catch {}

    // Probe BEFORE transcribing — a too-long source must fail fast and
    // cheaply instead of paying for transcription of an out-of-plan video.
    const duration = await probeDuration(src)
    const owner = await prisma.user.findUnique({ where: { id: project.userId }, select: { role: true } })
    const maxMin = planMaxMinutes(owner?.role)
    if (exceedsPlanMinutes(duration / 60, owner?.role)) {
      throw new Error(
        `Source is ${Math.round(duration / 60)} min — exceeds the ${maxMin} min limit for the ${owner?.role ?? 'FREE'} plan`
      )
    }

    console.log('[worker] transcribing')
    await setP(30, 'Transcribing speech audio with AI Whisper model...')
    const transcript = await transcribe(src, dir, project.language ?? 'auto')
    await prisma.project.update({ where: { id: project.id }, data: { transcript } }).catch((e) => {
      console.warn('[worker] failed to cache transcript to project:', e.message)
    })

    console.log('[worker] scoring moments')
    await setP(52, 'Scoring viral moments, hooks, retention & shareability...')
    const moments = await scoreMoments(transcript, duration, project.clipFrom ?? 0, project.instructions)
    if (!moments.length) throw new Error('no viable moments found')

    // AI motion graphics: admin-only feature with a global kill switch — re-checked at render time.
    let fx = !!project.motionFx
    if (fx) {
      const flag = await prisma.setting.findUnique({ where: { key: 'motion_fx' } })
      if (flag && flag.value !== 'true') fx = false
    }
    let pkgs = null
    if (fx) {
      console.log('[worker] designing AI motion packages')
      await setP(56, 'Generating AI motion graphics title cards...')
      const llmPacks = await llmMotionPackages(moments).catch(() => null)
      pkgs = moments.map((_, i) => llmPacks?.find((p) => p.index === i) ?? heuristicMotionPack({ ...moments[i], index: i }))
    }

    const captionStyle = project.captionStyle ?? 'hormozi'
    const aspectRatio = project.aspectRatio ?? '9:16'
    console.log(`[worker] rendering ${moments.length} clips (premium=${CFG.premium}, framing=${project.framing}, style=${captionStyle}, ratio=${aspectRatio}${fx ? ' +motion' : ''})`)
    await setP(58, 'Reframing vertical layout & rendering karaoke captions...')
    const files = await renderAll(src, moments, dir, transcript, project.framing ?? 'smart', pkgs, captionStyle, aspectRatio)

    for (let i = 0; i < moments.length; i++) {
      const m = moments[i]
      // Retry idempotency: a partially-failed run that uploaded clip N and is
      // re-queued must not duplicate it. Keeping the earlier render is safe.
      const existing = await prisma.clip.findFirst({ where: { projectId: project.id, sourceStart: m.start } })
      if (existing) {
        console.log(`[worker] ${project.id}: clip @${m.start}s already exists — keeping earlier render`)
        continue
      }
      const base = `${project.userId}/${project.id}`
      const url = await uploadToR2(files[i].file, `${base}/clip-${i + 1}.mp4`)
      const thumbUrl = await uploadToR2(files[i].thumb, `${base}/thumb-${i + 1}.jpg`, 'image/jpeg')

      const winWords = (transcript.words ?? []).filter((w) => w.end > m.start && w.start < m.end)
      await prisma.clip.create({
        data: {
          projectId: project.id,
          userId: project.userId,
          title: m.title || `Clip ${i + 1}`,
          description: m.reason,
          sourceStart: m.start, sourceEnd: m.end,
          duration: Math.round(m.end - m.start),
          viralScore: Math.round(m.score),
          hookScore: Math.round(m.hookScore ?? m.score),
          retentionScore: Math.round(m.retentionScore ?? m.score),
          shareScore: Math.round(m.shareScore ?? m.score),
          status: 'READY',
          videoUrl: url,
          exportUrl: url,
          thumbnailUrl: thumbUrl,
          captionStyle: captionStyle,
          captionData: { mode: 'karaoke', emoji: m.emoji ?? '', words: winWords, style: captionStyle },
          motionGraphics: { ...(files[i].motion ?? { mode: 'none' }), cropMode: files[i].cropMode },
        },
      })
      await setP(62 + Math.round(((i + 1) / moments.length) * 36), `Uploading clip ${i + 1} of ${moments.length} to Cloudflare R2...`)
    }

    await prisma.project.update({ where: { id: project.id }, data: { status: 'COMPLETED' } })
    await setP(100, 'Processing complete! All clips ready.')

    // Charge per-clip usage on completion: 1 credit per generated video clip, +2 flat when AI motion was actually applied.
    // minCredits was already reserved upfront at project creation.
    const creditsSpent = calcClipCredits(moments.length, fx)
    const alreadyPaid = Math.max(0, project.creditsUsed ?? 0)
    const diff = creditsSpent - alreadyPaid

    await prisma.$transaction(async (tx) => {
      if (diff > 0) {
        const owner = await tx.user.findUnique({ where: { id: project.userId }, select: { credits: true } })
        const charged = Math.max(0, Math.min(diff, owner?.credits ?? 0))
        if (charged > 0) {
          await tx.user.update({ where: { id: project.userId }, data: { credits: { decrement: charged } } })
          await tx.creditTransaction.create({
            data: {
              userId: project.userId,
              amount: -charged,
              type: 'usage',
              description: `Clipping completion "${project.title}" (${moments.length} clips${fx ? ' · AI motion' : ''})`,
              metadata: { projectId: project.id, totalCost: creditsSpent, reserved: alreadyPaid },
            },
          })
        }
      } else if (diff < 0) {
        // Video cost less than upfront reservation -> refund difference
        const refundAmount = Math.abs(diff)
        await tx.user.update({ where: { id: project.userId }, data: { credits: { increment: refundAmount } } })
        await tx.creditTransaction.create({
          data: {
            userId: project.userId,
            amount: refundAmount,
            type: 'refund',
            description: `Adjustment refund for "${project.title}"`,
            metadata: { projectId: project.id, totalCost: creditsSpent, reserved: alreadyPaid },
          },
        })
      }
    })
    await prisma.project.update({ where: { id: project.id }, data: { creditsUsed: creditsSpent } })
    console.log(`[worker] settled ${creditsSpent} total credits for ${project.id} (alreadyPaid=${alreadyPaid}, diff=${diff})`)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/** Jobs stuck in `processing` longer than this are assumed lost to a crash. */
async function recoverStale() {
  try {
    const staleBefore = new Date(Date.now() - (await cfg()).stale_job_minutes * 60_000)
    const revived = await prisma.processingJob.updateMany({
      where: { status: 'processing', startedAt: { lt: staleBefore } },
      data: { status: 'queued', startedAt: null },
    })
    if (revived.count > 0) console.log(`[worker] requeued ${revived.count} stale job(s)`)
  } catch (e) {
    console.error('[worker] stale-job recovery failed:', e.message)
  }
}

/** Remove abandoned nology-* directories and cached sources in tmpdir older than 2-4 hours */
async function cleanOrphanTempDirs() {
  try {
    const fs = await import('fs/promises')
    const tDir = tmpdir()
    const entries = await fs.readdir(tDir)
    const now = Date.now()
    for (const entry of entries) {
      if (entry.startsWith('nology-') && entry !== 'nology-sources') {
        const fullPath = path.join(tDir, entry)
        const stat = await fs.stat(fullPath).catch(() => null)
        if (stat && stat.isDirectory() && now - stat.mtimeMs > 60 * 60 * 1000) {
          await fs.rm(fullPath, { recursive: true, force: true }).catch(() => {})
          console.log(`[worker] cleaned orphan temp dir: ${entry}`)
        }
      }
    }
    // Clean old cached source files
    const cacheDir = path.join(tDir, 'nology-sources')
    const cacheFiles = await fs.readdir(cacheDir).catch(() => [])
    for (const file of cacheFiles) {
      const p = path.join(cacheDir, file)
      const st = await fs.stat(p).catch(() => null)
      if (st && now - st.mtimeMs > 4 * 60 * 60 * 1000) {
        await fs.rm(p, { force: true }).catch(() => {})
      }
    }
  } catch {
    // Non-blocking
  }
}

/**
 * Atomic claim: the conditional updateMany only succeeds for ONE worker —
 * a second worker's claim matches zero rows and it moves on. This closes
 * the findFirst→update double-processing race between worker instances.
 */
async function claimNextJob() {
  const candidate = await prisma.processingJob.findFirst({
    where: { status: 'queued' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!candidate) return null

  const claimed = await prisma.processingJob.updateMany({
    where: { id: candidate.id, status: 'queued' },
    data: { status: 'processing', startedAt: new Date() },
  })
  if (claimed.count !== 1) return null // another worker won the race

  return prisma.processingJob.findUnique({ where: { id: candidate.id } })
}

async function loop() {
  const envFlags = {
    db: process.env.DATABASE_URL ? 1 : 0,
    r2: process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_ENDPOINT ? 1 : 0,
    cookies: process.env.YTDLP_COOKIES ? 1 : 0,
    groq: process.env.GROQ_API_KEY ? 1 : 0,
  }
  console.log(`[worker] online — premium=${CFG.premium}, parallel=${CFG.renderParallel}, env=${Object.entries(envFlags).map(([k, v]) => `${k}${v ? '+' : '-'}`).join('')}`)

  let lastSweep = 0
  for (;;) {
    // DB-backed knobs can be changed from the admin Settings panel at any
    // time — refresh the live config each loop (cheap, 60s cache).
    await syncConfigInto()

    // Periodic stale-job recovery & orphan directory cleanup:
    if (Date.now() - lastSweep >= 5 * 60_000) {
      lastSweep = Date.now()
      await recoverStale()
      await cleanOrphanTempDirs()
    }

    try {
      const job = await claimNextJob()
      if (!job) { await new Promise((r) => setTimeout(r, 5000)); continue }

      try {
        await processJob(job)
        await prisma.processingJob.update({ where: { id: job.id }, data: { status: 'completed', progress: 100, completedAt: new Date() } })
        console.log(`[worker] ${job.id}: DONE ✔`)
      } catch (e) {
        console.error(`[worker] ${job.id} FAILED:`, e.message)
        console.error(e.stack ?? e)
        await prisma.processingJob.update({ where: { id: job.id }, data: { status: 'failed', error: e.message } }).catch(() => {})

        if (job.type === 'clip_adjust') {
          const clipId = job.result?.clipId
          if (clipId) {
            const clip = await prisma.clip.findUnique({ where: { id: clipId }, select: { videoUrl: true } }).catch(() => null)
            await prisma.clip.update({
              where: { id: clipId },
              data: { status: clip?.videoUrl ? 'READY' : 'FAILED' },
            }).catch(() => {})
          }

          const charged = job.result?.chargedCredits
          if (charged > 0) {
            try {
              const project = await prisma.project.findUnique({ where: { id: job.projectId }, select: { userId: true, title: true } })
              if (project) {
                await prisma.$transaction([
                  prisma.user.update({ where: { id: project.userId }, data: { credits: { increment: charged } } }),
                  prisma.creditTransaction.create({
                    data: {
                      userId: project.userId,
                      amount: charged,
                      type: 'refund',
                      description: `Refund: Clip adjustment failed for "${project.title.slice(0, 50)}"`,
                      metadata: { projectId: job.projectId, clipId },
                    },
                  }),
                ])
                console.log(`[worker] refunded ${charged} credit for failed clip adjustment on ${job.projectId}`)
              }
            } catch (refErr) {
              console.error(`[worker] refund failed for clip adjust ${job.projectId}:`, refErr.message)
            }
          }
        } else {
          await prisma.project.update({ where: { id: job.projectId }, data: { status: 'FAILED' } }).catch(() => {})

          // Refund any upfront reserved credits so a failed run never penalises the user
          try {
            const p = await prisma.project.findUnique({ where: { id: job.projectId }, select: { userId: true, creditsUsed: true, title: true } })
            if (p && p.creditsUsed > 0) {
              await prisma.$transaction([
                prisma.user.update({ where: { id: p.userId }, data: { credits: { increment: p.creditsUsed } } }),
                prisma.creditTransaction.create({
                  data: {
                    userId: p.userId,
                    amount: p.creditsUsed,
                    type: 'refund',
                    description: `Refund: Processing failed for "${p.title.slice(0, 50)}"`,
                    metadata: { projectId: job.projectId },
                  },
                }),
                prisma.project.update({ where: { id: job.projectId }, data: { creditsUsed: 0 } }),
              ])
              console.log(`[worker] refunded ${p.creditsUsed} credits for failed project ${job.projectId}`)
            }
          } catch (refErr) {
            console.error(`[worker] refund failed for ${job.projectId}:`, refErr.message)
          }
        }
      }
    } catch (e) {
      console.error('[worker] loop error:', e.message)
      await new Promise((r) => setTimeout(r, 15000))
    }
  }
}

loop()
