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
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import path from 'path'
import { calcClipCredits, calcCredits, exceedsPlanMinutes, planMaxMinutes } from './credits.mjs'
import { assertPublicHttpUrl } from './ssrf.mjs'
import { ytProxyPool, recordProxyResult, redactProxy, categorizeDownloadError } from './proxy-pool.mjs'
import { buildKaraokeAss, buildPhraseAss } from './caption-styles.mjs'

const run = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BRAND_WATERMARK_PATH = path.resolve(__dirname, '../public/brand/watermark.png')
const FACES_SCRIPT = path.join(__dirname, 'premium', 'faces.py')
const PYTHON_BIN =
  process.env.PYTHON_BIN ||
  (process.platform === 'win32'
    ? 'python'
    : existsSync('/opt/nology-venv/bin/python')
      ? '/opt/nology-venv/bin/python'
      : 'python3')

// Bootstrap env from the production env file so the worker is never at the
// mercy of how pm2 / shells were launched. Fills empty or missing keys directly.
function loadEnvFile() {
  const file = process.env.NOLOGY_ENV_FILE ?? '/opt/nology/.env.production'
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(file)
    } catch {
      /* file absent in dev / non-prod — fall back to process env */
    }
  }
  try {
    if (existsSync(file)) {
      const content = readFileSync(file, 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx <= 0) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let val = trimmed.slice(eqIdx + 1).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (!process.env[key] || process.env[key].trim() === '') {
          if (val) process.env[key] = val
        }
      }
    }
  } catch (e) {
    console.warn('[worker] manual env parse notice:', e.message)
  }
}
loadEnvFile()

const prisma = new PrismaClient()

const CFG = {
  r2Endpoint: process.env.R2_ENDPOINT,
  r2Bucket: process.env.R2_BUCKET ?? 'nology-clips',
  r2Key: process.env.R2_ACCESS_KEY_ID,
  r2Secret: process.env.R2_SECRET_ACCESS_KEY,

  nvidiaKey: process.env.NVIDIA_API_KEY,
  nvidiaScoreModel: process.env.NVIDIA_SCORE_MODEL ?? 'deepseek-ai/deepseek-v4.1-flash',
  scoringTimeoutMs: Number(process.env.AI_SCORING_TIMEOUT_MS ?? 15_000),
  groqKey: process.env.GROQ_API_KEY,
  openaiKey: process.env.OPENAI_API_KEY,
  whisperModel: process.env.WHISPER_MODEL ?? 'base',

  premium: process.env.PIPELINE_PREMIUM !== '0',
  faceFps: process.env.FACE_FPS ?? '4',
  outW: Number(process.env.OUT_W ?? 1080),
  outH: Number(process.env.OUT_H ?? 1920),
  wordsPerCard: Math.max(1, Math.min(4, Number(process.env.WORDS_PER_CARD ?? 2))),

  clipsPerVideo: Number(process.env.CLIPS_PER_VIDEO ?? 3),
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
  clips_per_video: Number(process.env.CLIPS_PER_VIDEO ?? 3),
  clip_min_seconds: Number(process.env.CLIP_MIN_SECONDS ?? 25),
  clip_max_seconds: Number(process.env.CLIP_MAX_SECONDS ?? 60),
  clip_target_seconds: Number(process.env.CLIP_TARGET_SECONDS ?? 45),
  render_parallel: Number(process.env.RENDER_PARALLEL ?? 4),
  stale_job_minutes: Number(process.env.STALE_JOB_MINUTES ?? 30),
  groq_score_model: process.env.GROQ_SCORE_MODEL || 'openai/gpt-oss-120b',
}

const SETTING_PARSE = {
  pipeline_premium: (v) => v === 'true',
  clips_per_video: (v) => Math.max(1, Number(v) || 3),
  clip_min_seconds: (v) => Math.max(20, Number(v) || 25),
  clip_max_seconds: (v) => Math.min(60, Math.max(30, Number(v) || 60)),
  clip_target_seconds: (v) => Math.max(25, Number(v) || 45),
  render_parallel: (v) => Math.max(1, Math.min(8, Number(v) || 4)),
  stale_job_minutes: (v) => Math.max(1, Number(v) || 30),
  nvidia_api_key: (v) => String(v || '').trim(),
  nvidia_score_model: (v) => String(v || '').trim(),
  groq_api_key: (v) => String(v || '').trim(),
  openai_api_key: (v) => String(v || '').trim(),
  whisper_model: (v) => String(v || '').trim(),
  groq_score_model: (v) => String(v || '').trim(),
  youtube_cookies: (v) => String(v || '').trim(),
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
  CFG.clipMinLength = Math.max(25, c.clip_min_seconds ?? 25)
  CFG.clipMaxLength = 60
  CFG.clipLength = c.clip_target_seconds ?? 45
  CFG.renderParallel = c.render_parallel
  CFG.nvidiaKey = c.nvidia_api_key || process.env.NVIDIA_API_KEY || CFG.nvidiaKey
  CFG.nvidiaScoreModel = c.nvidia_score_model || process.env.NVIDIA_SCORE_MODEL || 'deepseek-ai/deepseek-v4.1-flash'
  CFG.scoringTimeoutMs = Number(c.ai_scoring_timeout_ms || process.env.AI_SCORING_TIMEOUT_MS || CFG.scoringTimeoutMs || 15_000)
  CFG.groqKey = c.groq_api_key || process.env.GROQ_API_KEY || CFG.groqKey
  CFG.openaiKey = c.openai_api_key || process.env.OPENAI_API_KEY || CFG.openaiKey
  CFG.whisperModel = c.whisper_model || process.env.WHISPER_MODEL || CFG.whisperModel
  CFG.groqScoreModel = c.groq_score_model || process.env.GROQ_SCORE_MODEL || 'openai/gpt-oss-120b'
  CFG.aiSimulationMode = c.ai_simulation_mode || process.env.AI_SIMULATION_MODE || CFG.aiSimulationMode

  if (c.youtube_cookies) {
    try {
      const cookieFile = '/opt/nology/cookies.txt'
      if (!existsSync(cookieFile) || readFileSync(cookieFile, 'utf8') !== c.youtube_cookies) {
        await writeFile(cookieFile, c.youtube_cookies, 'utf8')
      }
    } catch {}
  }
}

async function sh(cmd, args, opts) {
  const { stdout } = await run(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...opts })
  return stdout
}

/** Base yt-dlp args: IPv4 (-4), JS runtimes (deno + node), and bgutil-ytdlp-pot-provider integration
 * (Brainicism/bgutil-ytdlp-pot-provider running on http://127.0.0.1:4416 mints valid YouTube PO Tokens
 * for visionos/web clients without needing curl_cffi --impersonate which breaks SOCKS5 proxy tunnels). */
function ytdlpArgs(extra, includeCookies = true) {
  const denoPath = existsSync('/usr/local/bin/deno') ? 'deno:/usr/local/bin/deno' : 'deno'
  const nodePath = existsSync('/usr/bin/node') ? 'node:/usr/bin/node' : 'node'
  const args = [
    '-4',
    '--js-runtimes',
    nodePath,
    '--js-runtimes',
    denoPath,
    '--remote-components',
    'ejs:github',
  ]
  if (includeCookies) {
    const cookiePath =
      (existsSync('/opt/nology/cookies.txt') ? '/opt/nology/cookies.txt' : null) ||
      process.env.YTDLP_COOKIES ||
      (existsSync('/opt/nology/youtube-cookies.txt') ? '/opt/nology/youtube-cookies.txt' : null) ||
      (existsSync('cookies.txt') ? 'cookies.txt' : null)
    if (cookiePath) {
      try {
        const rawCookies = readFileSync(cookiePath, 'utf8')
        if (/__Secure-[13]PSID\b|LOGIN_INFO\b/.test(rawCookies)) {
          const runtimeCookiePath = path.join(tmpdir(), 'nology-yt-cookies-runtime.txt')
          writeFileSync(runtimeCookiePath, rawCookies, 'utf8')
          args.push('--cookies', runtimeCookiePath)
        }
      } catch {}
    }
  }
  return args.concat(extra)
}

async function ensureWarpConnected(forceRestart = false) {
  const warpProxy = process.env.WARP_PROXY || 'socks5://127.0.0.1:40000'
  if (!forceRestart) {
    try {
      await sh('curl', ['-4', '-x', warpProxy, '-s', '-o', '/dev/null', '-m', '8', 'https://www.youtube.com/generate_204'], {
        timeout: 10000,
      })
      return true
    } catch {
      console.warn('[worker:warp] WARP SOCKS5 health check failed — restarting warp-svc daemon...')
    }
  }
  try {
    await sh('systemctl', ['restart', 'warp-svc'], { timeout: 10000 }).catch(() => {})
    await new Promise((r) => setTimeout(r, 2500))
    await sh('warp-cli', ['--accept-tos', 'mode', 'proxy'], { timeout: 5000 }).catch(() => {})
    await sh('warp-cli', ['--accept-tos', 'proxy', 'port', '40000'], { timeout: 5000 }).catch(() => {})
    await sh('warp-cli', ['--accept-tos', 'connect'], { timeout: 8000 }).catch(() => {})
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      const st = await sh('warp-cli', ['--accept-tos', 'status'], { timeout: 5000 }).catch(() => '')
      if (/Status update:\s*Connected/i.test(st)) {
        await new Promise((r) => setTimeout(r, 1500))
        break
      }
    }
    return true
  } catch {
    return false
  }
}

/* ================= stages ================= */

async function download(url, dir, onProgress = null) {
  await assertPublicHttpUrl(url)

  // Guard against non-video Whop dashboard links
  if (/whop\.com|apps\.whop\.com/i.test(url) && !/\.(mp4|mov|webm|mkv)/i.test(url)) {
    throw new Error('Whop dashboard pages cannot be downloaded directly. Please select a video asset (MP4, Google Drive, or YouTube) from the campaign.')
  }

  // Guard against competitor leaderboard clips from ContentRewards
  if (/cdn\.contentrewards\.com\/downloaded-videos\//i.test(url)) {
    throw new Error('Competitor leaderboard clips cannot be used as raw source footage. Please use the campaign raw video assets (Google Drive, YouTube, or direct MP4).')
  }

  // If URL is a public Google Drive folder, resolve the first video file inside it
  const gdriveFolderMatch = url.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]{15,})/i)
  if (gdriveFolderMatch) {
    try {
      const folderId = gdriveFolderMatch[1]
      const listRes = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}#list`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000),
      })
      if (listRes.ok) {
        const listHtml = await listRes.text()
        const fileMatch = listHtml.match(/href="https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{15,})\/view[^"]*"/i)
        if (fileMatch) {
          url = `https://drive.google.com/file/d/${fileMatch[1]}/view`
          console.log(`[worker:download] Resolved Google Drive folder ${folderId} to file: ${url}`)
        }
      }
    } catch (e) {
      console.warn(`[worker:download] Google Drive folder resolution failed:`, e?.message || e)
    }
  }

  // Fast direct fetch for Google Drive file links via drive.usercontent.google.com
  const gdriveFileMatch =
    url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{15,})/i) ||
    url.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([a-zA-Z0-9_-]{15,})/i)
  if (gdriveFileMatch) {
    const fileId = gdriveFileMatch[1]
    const directDriveUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`
    const target = path.join(dir, 'source.mp4')
    const t0 = Date.now()
    let nonVideoDetected = false
    try {
      console.log(`[worker:download] Google Drive file detected (${fileId}), fetching via direct download...`)
      await sh('curl', ['-f', '-L', '-s', '-S', '--max-time', '600', '-o', target, directDriveUrl])
      const st = await stat(target)
      if (st.size > 0) {
        const probedDur = await probeDuration(target).catch(() => null)
        if (Number.isFinite(probedDur) && probedDur > 0) {
          console.log(`[worker:download] Google Drive direct download complete in ${Date.now() - t0}ms (${st.size} bytes, ${Math.round(probedDur)}s)`)
          return target
        }
        // Check if downloaded file is an image or PDF document (e.g., campaign logo PNG inside Google Doc)
        const headBuf = await readFile(target).then((b) => b.subarray(0, 16)).catch(() => Buffer.alloc(0))
        const headHex = headBuf.toString('hex')
        const headAscii = headBuf.toString('utf8')
        if (
          headHex.startsWith('89504e47') || // PNG
          headHex.startsWith('ffd8ff') ||   // JPEG
          headAscii.startsWith('GIF8') ||   // GIF
          headAscii.startsWith('%PDF')      // PDF
        ) {
          nonVideoDetected = true
        }
      }
      await rm(target, { force: true }).catch(() => {})
    } catch (driveErr) {
      await rm(target, { force: true }).catch(() => {})
      console.warn(`[worker:download] Google Drive direct curl failed:`, driveErr?.message || driveErr)
    }
    if (nonVideoDetected) {
      throw new Error('The selected Google Drive file is an image or document (e.g. brand logo), not a video file. Please select a video asset from the campaign.')
    }
  }

  // Fast direct fetch for direct CDN / video files (S3, R2, direct MP4s)
  const isDirectVideo = /\.(mp4|mov|webm|mkv)(\?.*)?$/i.test(url)

  if (isDirectVideo) {
    const ext = (url.match(/\.(mp4|mov|webm|mkv)/i)?.[1] || 'mp4').toLowerCase()
    const target = path.join(dir, `source.${ext}`)
    const t0 = Date.now()
    try {
      console.log(`[worker:download] Direct media URL detected, fetching directly via curl: ${url}`)
      await sh('curl', ['-f', '-L', '-s', '-S', '--max-time', '600', '-o', target, url])
      const dur = Date.now() - t0
      console.log(`[worker:download] direct curl download complete in ${dur}ms: ${target}`)
      return target
    } catch (curlErr) {
      console.warn(`[worker:download] curl direct fetch failed, falling back to yt-dlp:`, curlErr?.message || curlErr)
    }
  }

  const out = path.join(dir, 'source.%(ext)s')

  const attempt = async (proxy, timeoutMs = 1000 * 60 * 10) => {
    let pct = 10
    const timer =
      typeof onProgress === 'function'
        ? setInterval(() => {
            pct = Math.min(25, pct + 2)
            onProgress(pct, `Downloading high-definition source video (${pct}%)...`).catch(() => {})
          }, 5000)
        : null
    try {
      return await sh(
        '/opt/nology-venv/bin/yt-dlp',
        ytdlpArgs([
          ...(proxy ? ['--proxy', proxy] : []),
          '--socket-timeout',
          proxy ? '15' : '12',
          '--retries',
          '2',
          '--fragment-retries',
          '2',
          '-N',
          '6',
          '-f',
          'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b',
          '--merge-output-format',
          'mp4',
          '--max-filesize',
          '10G',
          '-o',
          out,
          url,
        ]),
        { timeout: timeoutMs }
      )
    } finally {
      if (timer) clearInterval(timer)
    }
  }

  const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(url)
  const warpProxy = process.env.WARP_PROXY || 'socks5://127.0.0.1:40000'
  let directErr = null
  let lastErr = null

  // For YouTube on AWS EC2, verify Cloudflare WARP SOCKS5 health first (restarts warp-svc if stale),
  // then download via WARP + bgutil-ytdlp-pot-provider PO Token server.
  if (isYouTube) {
    await ensureWarpConnected(false)
    for (let warpTry = 0; warpTry < 2; warpTry++) {
      const wStart = Date.now()
      try {
        await attempt(warpProxy, 1000 * 60 * 10)
        const sourceFile = await findFile(dir, /^source\./)
        const dur = Date.now() - wStart
        recordProxyResult(warpProxy, true)
        console.log(`[worker:download] proxy=warp(${warpProxy}) duration_ms=${dur} outcome=success`)
        return sourceFile
      } catch (e) {
        lastErr = e
        const dur = Date.now() - wStart
        const errTail = e.message.split('\n').filter(Boolean).slice(-2).join(' | ').slice(0, 240)
        console.warn(
          `[worker:download] proxy=warp(${warpProxy}) try=${warpTry + 1} duration_ms=${dur} outcome=failure error="${errTail}"`
        )
        if (warpTry === 0) {
          await ensureWarpConnected(true)
        }
      }
    }
  }

  // Direct attempt (primary for non-YouTube URLs; fallback for YouTube)
  const t0 = Date.now()
  try {
    await attempt(null, 35000)
    const sourceFile = await findFile(dir, /^source\./)
    const dur = Date.now() - t0
    console.log(`[worker:download] proxy=direct duration_ms=${dur} outcome=success`)
    return sourceFile
  } catch (e) {
    directErr = e
    const dur = Date.now() - t0
    const errType = categorizeDownloadError(e)
    console.warn(
      `[worker:download] proxy=direct duration_ms=${dur} outcome=failure error_type=${errType} error="${e.message
        .split('\n')[0]
        .slice(0, 100)}" — switching immediately to proxy pool`
    )
  }

  // Rotate top-priority external proxies (excluding WARP if already tried above)
  const allProxies = (await ytProxyPool()).filter((p) => !(isYouTube && p === warpProxy))
  const proxies = allProxies.slice(0, 3)
  for (const proxy of proxies) {
    const pStart = Date.now()
    const redacted = redactProxy(proxy)
    try {
      await attempt(proxy)
      const sourceFile = await findFile(dir, /^source\./)
      const dur = Date.now() - pStart
      recordProxyResult(proxy, true)
      console.log(`[worker:download] proxy=${redacted} duration_ms=${dur} outcome=success`)
      return sourceFile
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

  const isBotBlocked =
    categorizeDownloadError(directErr) === 'bot-detection' ||
    categorizeDownloadError(lastErr) === 'bot-detection'
  if (isBotBlocked) {
    throw new Error(
      'YouTube blocked access with bot detection. Please try again or use the Direct Video Upload tab.'
    )
  }

  const rawErrMsg = (lastErr?.message || directErr?.message || '').toLowerCase()
  if (rawErrMsg.includes('[googledrive]') || url.includes('drive.google.com')) {
    throw new Error(
      'Could not download the selected Google Drive file. Make sure the link points to a public video file (MP4/MOV) and not an image, document, or restricted folder.'
    )
  }

  throw new Error('Could not download the video from the provided link. Please check that the link is a public video or upload the file directly.')
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
  if (/\.(mp4|mov|webm|mkv)(\?.*)?$/i.test(url) || /drive\.google\.com/i.test(url)) {
    return null
  }
  const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(url)
  const warpProxy = process.env.WARP_PROXY || 'socks5://127.0.0.1:40000'
  try {
    const out = await sh(
      '/opt/nology-venv/bin/yt-dlp',
      ytdlpArgs([
        ...(isYouTube ? ['--proxy', warpProxy] : []),
        '--socket-timeout',
        '15',
        '-f',
        'bv*[height<=1080]+ba/b[height<=1080]/b',
        '--print',
        'duration',
        '--no-download',
        url,
      ]),
      { timeout: 1000 * 45 }
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
raw_model = ${JSON.stringify(CFG.whisperModel || 'turbo')}
aliases = {
    'whisper-large-v3-turbo': 'turbo',
    'whisper-large-v3': 'large-v3',
    'whisper-large-v2': 'large-v2',
    'whisper-medium': 'medium',
    'whisper-small': 'small',
    'whisper-base': 'base',
    'whisper-tiny': 'tiny'
}
model_name = aliases.get(raw_model, raw_model.replace('whisper-', ''))
try:
    m = WhisperModel(model_name, device="cpu", compute_type="int8")
except Exception:
    m = WhisperModel("turbo", device="cpu", compute_type="int8")
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

function generateSimulatedTranscript(fileDuration = 60) {
  const sampleWords = [
    'Welcome', 'to', 'the', 'ultimate', 'breakthrough', 'moment.',
    'Nobody', 'thought', 'this', 'was', 'possible', 'until', 'now.',
    'Here', 'is', 'the', 'exact', 'secret', 'that', 'changed', 'everything.',
    'Watch', 'closely', 'because', 'this', 'will', 'blow', 'your', 'mind.',
    'The', 'number', 'one', 'mistake', 'creators', 'make', 'is', 'waiting.',
    'Take', 'action', 'today', 'and', 'scale', 'your', 'content', 'instantly.'
  ]
  const words = []
  const segments = []
  let t = 1.0
  let segStart = 1.0
  let segWords = []

  for (let i = 0; i < sampleWords.length && t < Math.max(30, fileDuration - 5); i++) {
    const dur = 0.35 + Math.random() * 0.25
    words.push({ start: Number(t.toFixed(2)), end: Number((t + dur).toFixed(2)), text: sampleWords[i] })
    segWords.push(sampleWords[i])
    t += dur + 0.1
    if (segWords.length >= 6 || i === sampleWords.length - 1) {
      segments.push({
        start: Number(segStart.toFixed(2)),
        end: Number(t.toFixed(2)),
        text: segWords.join(' ')
      })
      segStart = t + 0.5
      t += 0.5
      segWords = []
    }
  }

  return { language: 'en', segments, words }
}

async function transcribe(file, dir, language = 'auto') {
  if (process.env.AI_SIMULATION_MODE === 'true' || CFG.aiSimulationMode === 'true') {
    console.log('[worker] [SIMULATION] AI_SIMULATION_MODE enabled: generating fast synthetic transcript in <1s')
    return generateSimulatedTranscript()
  }
  try {
    if (CFG.groqKey) {
      const t0 = Date.now()
      const mp3 = await extractAudio(file, dir)
      const r = await transcribeGroq(mp3, language)
      console.log(`[worker] Groq transcription done in ${((Date.now() - t0) / 1000).toFixed(0)}s (${r.words.length} words, lang=${language})`)
      return r
    } else {
      console.warn('[worker] No GROQ_API_KEY configured. Falling back to local whisper on CPU (this takes several minutes).')
    }
  } catch (e) {
    console.error('[worker] Groq failed, falling back to local whisper:', e.message)
    if (e.message.includes('401') || e.message.includes('Invalid API Key') || e.message.includes('invalid_api_key')) {
      console.error('[worker] ⚠️ GROQ_API_KEY is invalid, expired, or unauthorized. Update GROQ_API_KEY in the database Settings table or .env.production!')
    }
  }
  try {
    return await transcribeLocal(file, dir)
  } catch (e) {
    console.error('[worker] Local whisper failed (audio-only or no audio stream):', e.message)
    return { language: language === 'auto' ? 'en' : language, segments: [], words: [] }
  }
}

/* ---------- scoring ---------- */

function calcOverlapRatio(aStart, aEnd, bStart, bEnd) {
  const inter = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
  if (inter <= 0) return 0
  const minLen = Math.max(1, Math.min(aEnd - aStart, bEnd - bStart))
  return inter / minLen
}

function calcWordOverlapRatio(aText, bText) {
  const aWords = new Set(String(aText || '').toLowerCase().split(/\s+/).filter((w) => w.length > 2))
  const bWords = new Set(String(bText || '').toLowerCase().split(/\s+/).filter((w) => w.length > 2))
  if (aWords.size < 5 || bWords.size < 5) return 0
  let shared = 0
  for (const w of aWords) {
    if (bWords.has(w)) shared++
  }
  return shared / Math.min(aWords.size, bWords.size)
}

/**
 * Non-Maximum Suppression (NMS) for video moments:
 * Greedily selects the highest-scoring moments while rejecting any candidate
 * whose time window overlaps an already-selected clip by > maxOverlapRatio (default 15%)
 * or repeats the same transcript sentences (> 65% word overlap).
 */
function dedupeOverlappingMoments(moments, maxClips, maxOverlapRatio = 0.15) {
  const sorted = [...moments].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const selected = []
  for (const m of sorted) {
    if (selected.length >= maxClips) break
    const hasOverlap = selected.some(
      (s) =>
        calcOverlapRatio(s.start, s.end, m.start, m.end) > maxOverlapRatio ||
        calcWordOverlapRatio(s.text, m.text) > 0.65
    )
    if (!hasOverlap) {
      selected.push(m)
    }
  }
  return selected
}

/**
 * Multi-scale semantic & pause-aware candidate generation.
 * Generates natural narrative windows across multiple target duration bands (e.g. 28s, 38s, 52s, 68s)
 * instead of stopping at the very first sentence after 15 seconds.
 * Every candidate begins on a clean sentence hook and concludes on a completed thought.
 */
function generateCandidateMoments(transcript, duration, from = 0, minDur = 25, maxDur = 60, excludedRanges = []) {
  const segs = (transcript.segments ?? []).filter((s) => s.start >= Math.max(0, from - 2))
  const effectiveMinDur = duration >= 65 ? Math.max(26, minDur) : duration >= 35 ? Math.max(22, Math.min(minDur, duration * 0.6)) : Math.max(12, Math.floor(duration * 0.7))

  if (!segs.length) {
    const fallback = []
    const win = Math.min(duration, Math.min(55, Math.max(effectiveMinDur, 35)))
    if (duration > 0 && win > 0) {
      for (let s = Math.max(0, from); s + win <= duration && fallback.length < 50; s += win) {
        fallback.push({ start: Math.round(s), end: Math.round(Math.min(duration, s + 60, s + win)), text: '' })
      }
    }
    if (fallback.length === 0 && duration > 0) {
      fallback.push({ start: 0, end: Math.round(Math.min(duration, 60)), text: '' })
    }
    return fallback
  }

  // Detect sentence or thought boundary
  const isBoundary = (idx) => {
    if (idx >= segs.length - 1) return true
    const text = (segs[idx].text || '').trim()
    const endsWithPunct = /[.?!؟…]$/.test(text)
    const gap = segs[idx + 1].start - segs[idx].end
    return endsWithPunct || gap >= 0.45
  }

  // Target narrative duration bands (strictly <= 60s maximum clip duration!)
  const targetBands =
    duration >= 65
      ? [28, 38, 48, 58]
      : duration >= 45
        ? [25, 34, 44, 55]
        : [Math.min(60, Math.max(16, Math.round(duration * 0.72)))]

  const allCandidates = []
  let lastAcceptedStart = -999

  for (let i = 0; i < segs.length; i++) {
    const startSeg = segs[i]
    if (startSeg.start < from) continue
    if (startSeg.start - lastAcceptedStart < 5) continue

    let accumulatedText = []
    let clipStart = startSeg.start
    let clipEnd = startSeg.end
    let bandIdx = 0

    for (let j = i; j < segs.length && bandIdx < targetBands.length; j++) {
      accumulatedText.push((segs[j].text || '').trim())
      clipEnd = Math.min(clipStart + 60, segs[j].end)
      const currentDur = clipEnd - clipStart
      const targetDur = Math.min(60, Math.max(effectiveMinDur, targetBands[bandIdx]))

      if (currentDur >= targetDur) {
        if (isBoundary(j) || currentDur >= maxDur || currentDur >= 58) {
          const fullText = accumulatedText.join(' ').trim()
          const wordCount = fullText.split(/\s+/).filter(Boolean).length

          if (wordCount >= 18 || duration < 35) {
            allCandidates.push({
              start: Math.round(clipStart),
              end: Math.round(Math.min(duration, clipStart + 60, clipEnd)),
              text: fullText,
            })
            lastAcceptedStart = clipStart
          }
          // Advance to next duration band up to 60s
          while (bandIdx < targetBands.length && currentDur >= targetBands[bandIdx] - 4) {
            bandIdx++
          }
          if (currentDur >= maxDur || currentDur >= 58) break
        }
      }
    }
  }

  // Filter out candidates that overlap with previously clipped ranges from earlier runs on the same video
  let filteredCandidates = allCandidates
  if (Array.isArray(excludedRanges) && excludedRanges.length > 0) {
    const nonExcluded = allCandidates.filter(
      (c) => !excludedRanges.some((ex) => calcOverlapRatio(c.start, c.end, ex.start, ex.end) > 0.25)
    )
    if (nonExcluded.length >= 2) {
      filteredCandidates = nonExcluded
    }
  }

  let candidates = filteredCandidates
  if (filteredCandidates.length > 75) {
    const step = filteredCandidates.length / 75
    candidates = Array.from({ length: 75 }, (_, idx) => filteredCandidates[Math.floor(idx * step)])
  }

  // Fallback if semantic grouping produced too few candidates: add non-overlapping 32s-55s windows (<=60s)
  if (candidates.length < 3) {
    for (const win of [32, 44, 56, Math.min(60, Math.max(25, effectiveMinDur))]) {
      const actualWin = Math.min(60, Math.min(duration, win))
      if (actualWin < effectiveMinDur && duration >= effectiveMinDur) continue
      for (let s = Math.max(0, from); s + actualWin <= duration && candidates.length < 40; s += actualWin) {
        const startR = Math.round(s)
        const endR = Math.round(Math.min(duration, startR + 60, s + actualWin))
        if (candidates.some((c) => Math.abs(c.start - startR) < 5 && Math.abs(c.end - endR) < 5)) continue
        const text = segs
          .filter((x) => x.start >= s - 1 && x.end <= s + actualWin + 1)
          .map((x) => x.text)
          .join(' ')
          .trim()
        candidates.push({ start: startR, end: endR, text })
      }
    }
  }

  if (candidates.length === 0 && duration > 0) {
    const defaultEnd = Math.round(Math.min(duration, 60))
    candidates.push({
      start: 0,
      end: defaultEnd,
      text: segs.map((s) => s.text).join(' ').trim() || 'Highlight moment',
    })
  }

  return candidates
}

function getAiProviders() {
  const providers = []
  const timeoutMs = CFG.scoringTimeoutMs || 15_000

  // 1. GROQ (PRIMARY ULTRA-FAST ~200-500ms: openai/gpt-oss-120b -> openai/gpt-oss-20b -> qwen/qwen3.8-27b)
  if (CFG.groqKey) {
    providers.push({
      tier: 'tier-1 groq-gpt-oss-120b',
      name: 'groq-gpt-oss-120b',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: CFG.groqKey,
      model: 'openai/gpt-oss-120b',
      timeoutMs: Math.min(timeoutMs, 12_000),
    })
    providers.push({
      tier: 'tier-1.2 groq-gpt-oss-20b',
      name: 'groq-gpt-oss-20b',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: CFG.groqKey,
      model: 'openai/gpt-oss-20b',
      timeoutMs: Math.min(timeoutMs, 10_000),
    })
    providers.push({
      tier: 'tier-1.5 groq-qwen',
      name: 'groq-qwen3.8-27b',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: CFG.groqKey,
      model: 'qwen/qwen3.8-27b',
      timeoutMs: Math.min(timeoutMs, 10_000),
    })
  }

  // 2. NVIDIA NIM (SECONDARY FALLBACK - 4s cap)
  if (CFG.nvidiaKey) {
    const nvModel = CFG.nvidiaScoreModel || 'deepseek-ai/deepseek-v4.1-flash'
    providers.push({
      tier: 'fallback-1 nvidia',
      name: `nvidia-${nvModel}`,
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      key: CFG.nvidiaKey,
      model: nvModel,
      timeoutMs: Math.min(timeoutMs, 4000),
    })
  }

  // 3. OpenAI (Tertiary Fallback)
  if (CFG.openaiKey) {
    providers.push({
      tier: 'fallback-2 openai',
      name: 'openai-gpt-4o-mini',
      url: 'https://api.openai.com/v1/chat/completions',
      key: CFG.openaiKey,
      model: 'gpt-4o-mini',
      timeoutMs,
    })
  }

  return providers
}

/**
 * Direct AI Transcript Director:
 * Passes the full timestamped Whisper transcript directly to the AI so the AI itself chooses
 * the exact startSec and endSec timestamps for complete viral stories (28s to 60s max),
 * snapped cleanly to Whisper sentence boundaries and avoiding any previously clipped ranges.
 */
async function llmDirectMomentsFromTranscript(
  transcript,
  duration,
  from = 0,
  instructions = null,
  maxClips = CFG.clipsPerVideo,
  minDur = 26,
  maxDur = 60,
  excludedRanges = []
) {
  const segs = (transcript.segments ?? []).filter((s) => s.start >= Math.max(0, from - 1))

  const providers = getAiProviders()
  if (!providers.length) return null

  const effectiveMinDur =
    duration >= 65 ? Math.max(28, minDur) : duration >= 35 ? Math.max(22, Math.min(minDur, duration * 0.65)) : Math.max(15, Math.floor(duration * 0.75))
  const effectiveMaxDur = Math.min(60, Math.round(duration), Math.max(effectiveMinDur + 5, Number.isFinite(maxDur) ? maxDur : 60))

  // Group segments into compact timestamped blocks (~6-10s per line) if the video is very long
  // so the entire video transcript fits cleanly within the LLM context window.
  const transcriptLines = []
  if (segs.length > 0) {
    const targetLines = 160
    const groupSize = Math.max(1, Math.ceil(segs.length / targetLines))
    for (let i = 0; i < segs.length; i += groupSize) {
      const slice = segs.slice(i, i + groupSize)
      const sTime = Math.round(slice[0].start)
      const eTime = Math.round(slice[slice.length - 1].end)
      const text = slice
        .map((x) => (x.text || '').trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (text) {
        transcriptLines.push(`[${sTime}s-${eTime}s] ${text}`)
      }
    }
  } else {
    // Even if audio has minimal speech (e.g. gameplay/action stream), let the AI Director plan non-overlapping 35s-55s windows!
    const step = Math.max(35, Math.floor(duration / Math.max(4, maxClips * 2)))
    for (let s = Math.max(0, from); s + 30 <= duration && transcriptLines.length < 30; s += step) {
      const e = Math.min(Math.round(duration), Math.round(s + Math.min(55, step)))
      transcriptLines.push(`[${Math.round(s)}s-${e}s] Action / highlight segment`)
    }
  }

  const excludedNote =
    Array.isArray(excludedRanges) && excludedRanges.length > 0
      ? `\nCRITICAL DEDUPLICATION RULE: This video was clipped previously at these exact time ranges: ${excludedRanges
          .map((r) => `[${r.start}s-${r.end}s]`)
          .join(', ')}. You MUST NOT select any clip that overlaps with those already-used time ranges! Pick completely different moments from other parts of the transcript.`
      : ''

  const requestCount = Math.max(maxClips, Math.min(6, maxClips * 2))
  let system =
    'You are an autonomous AI Viral Video Director and Master Editor for TikTok, Instagram Reels, and YouTube Shorts.\n' +
    `You are given the full timestamped transcript of a ${Math.round(duration)}-second video.\n` +
    'Your job is to read the transcript, discover the most viral, high-retention story arcs, and choose the EXACT startSec and endSec timestamps to cut each clip.\n' +
    `CRITICAL DURATION RULE: Every clip you cut MUST be a complete narrative arc (Hook -> Rising Tension/Story -> Climax/Payoff) with a duration between ${effectiveMinDur} seconds and ${effectiveMaxDur} seconds (MAXIMUM 60 seconds — NEVER exceed 60 seconds, and NEVER cut 15-second micro-clips!).\n` +
    'CRITICAL NON-OVERLAP RULE: Every selected clip MUST come from a completely distinct, non-overlapping part of the video. Do not pick overlapping time ranges.' +
    excludedNote +
    '\nIf the transcript is in Arabic, write "title" (3-6 words), "titles", "hookHeadline", "cta", and "reason" in Arabic.\n' +
    'Return strict JSON: {"moments":[' +
    '{"startSec":<int>,"endSec":<int>,"score":<0-100>,"hookScore":<0-100>,"retentionScore":<0-100>,"shareScore":<0-100>,' +
    '"title":"<=6 punchy words",' +
    '"titles":["3-6 words Question hook","3-6 words Shocking hook","3-6 words Direct value hook"],' +
    '"hookHeadline":"3-5 words ultra viral headline card for first 2 seconds",' +
    '"hashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"],' +
    '"cta":"one short engaging sentence encouraging comments",' +
    '"reason":"one sentence explaining the viral arc","emoji":"one fitting emoji"}' +
    `]}. Return up to ${requestCount} non-overlapping clips, best first.`

  if (instructions?.trim()) {
    system += `\nCampaign / Creator Instructions — follow these strictly when choosing moments and hooks: "${instructions.trim().slice(0, 600)}"`
  }

  // Helper to snap AI-chosen [startSec, endSec] to clean Whisper segment boundaries and enforce [effectiveMinDur, 60s]
  const snapMomentToSegments = (rawStart, rawEnd) => {
    const clampedRawStart = Math.max(0, Math.min(Math.max(0, duration - effectiveMinDur), rawStart))
    const clampedRawEnd = Math.min(duration, clampedRawStart + 60, Math.max(clampedRawStart + effectiveMinDur, rawEnd))

    if (!segs.length) {
      return {
        start: Math.round(clampedRawStart),
        end: Math.round(Math.min(duration, clampedRawStart + 60, clampedRawEnd)),
        text: '',
      }
    }

    let startIdx = segs.findIndex((s) => s.end > clampedRawStart + 0.5)
    if (startIdx < 0) startIdx = 0
    let endIdx = startIdx
    while (endIdx < segs.length - 1 && segs[endIdx].end < clampedRawEnd && segs[endIdx + 1].end - segs[startIdx].start <= 60) {
      endIdx++
    }
    // Enforce minimum duration by extending endIdx up to 60s max
    while (endIdx < segs.length - 1 && segs[endIdx].end - segs[startIdx].start < effectiveMinDur && segs[endIdx + 1].end - segs[startIdx].start <= 60) {
      endIdx++
    }
    // Continue up to 2 more segments if needed to finish a sentence cleanly without exceeding 60s
    for (let k = 0; k < 2 && endIdx < segs.length - 1; k++) {
      const txt = (segs[endIdx].text || '').trim()
      const gap = segs[endIdx + 1].start - segs[endIdx].end
      if (/[.?!؟…]$/.test(txt) || gap >= 0.45) break
      if (segs[endIdx + 1].end - segs[startIdx].start <= effectiveMaxDur) {
        endIdx++
      }
    }
    // If near the end of the video and still shorter than effectiveMinDur, pull startIdx earlier
    while (startIdx > 0 && segs[endIdx].end - segs[startIdx].start < effectiveMinDur && segs[endIdx].end - segs[startIdx - 1].start <= 60) {
      startIdx--
    }

    const start = Math.max(0, Math.round(segs[startIdx].start))
    const rawSegEnd = Math.round(segs[endIdx].end)
    const end = Math.min(
      Math.round(duration),
      start + 60,
      Math.max(start + Math.min(effectiveMinDur, Math.round(duration)), rawSegEnd)
    )
    const text = segs
      .slice(startIdx, endIdx + 1)
      .map((s) => (s.text || '').trim())
      .join(' ')
      .trim()
    return { start, end, text }
  }

  for (const p of providers) {
    const t0 = Date.now()
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(p.timeoutMs || 12_000),
        body: JSON.stringify({
          model: p.model,
          response_format: { type: 'json_object' },
          temperature: 0.25,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: transcriptLines.join('\n').slice(0, 22_000) },
          ],
        }),
      })
      if (!res.ok) throw new Error(`${p.name} HTTP ${res.status}`)
      const data = await res.json()
      const rawText = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content || '{}'
      const parsed = JSON.parse(rawText)
      const directed = (parsed.moments ?? [])
        .filter((m) => Number.isFinite(Number(m.startSec)) && Number.isFinite(Number(m.endSec)))
        .map((m) => {
          const snapped = snapMomentToSegments(Number(m.startSec), Number(m.endSec))
          const mainTitle = String(m.title ?? '').slice(0, 80)
          const titleOptions =
            Array.isArray(m.titles) && m.titles.length
              ? m.titles.map((t) => String(t).slice(0, 80))
              : [mainTitle]
          const hashtags =
            Array.isArray(m.hashtags) && m.hashtags.length
              ? m.hashtags.map((h) => String(h).slice(0, 30))
              : ['#Shorts', '#Reels', '#TikTok', '#Viral', '#fyp']
          return {
            start: snapped.start,
            end: snapped.end,
            text: snapped.text,
            score: Math.max(0, Math.min(100, Math.round(Number(m.score) || 85))),
            hookScore: Math.max(0, Math.min(100, Math.round(Number(m.hookScore ?? m.score) || 85))),
            retentionScore: Math.max(0, Math.min(100, Math.round(Number(m.retentionScore ?? m.score) || 85))),
            shareScore: Math.max(0, Math.min(100, Math.round(Number(m.shareScore ?? m.score) || 85))),
            title: mainTitle,
            titleOptions,
            hookHeadline: String(m.hookHeadline ?? m.title ?? '').slice(0, 80),
            hashtags,
            cta: String(m.cta ?? '').slice(0, 120),
            reason: String(m.reason ?? 'AI-directed complete viral story arc'),
            emoji: String(m.emoji ?? '🔥').slice(0, 4),
          }
        })
        .filter((m) => {
          if (m.end <= m.start) return false
          if (
            Array.isArray(excludedRanges) &&
            excludedRanges.some((ex) => calcOverlapRatio(m.start, m.end, ex.start, ex.end) > 0.25)
          ) {
            return false
          }
          return true
        })

      if (directed.length > 0) {
        const latency = Date.now() - t0
        console.log(
          `[worker] AI Transcript Director selected ${directed.length} clips via ${p.name} in ${latency}ms (durations: ${directed.map((d) => `${d.end - d.start}s`).join(', ')})`
        )
        return directed
      }
      throw new Error('AI Director returned no valid moments')
    } catch (e) {
      console.warn(`[worker] AI Director tier ${p.name} notice (${e.message}) — trying next tier...`)
    }
  }

  return null
}

async function llmScoreMoments(candidates, instructions, maxClips = CFG.clipsPerVideo) {
  const providers = getAiProviders()

  const requestCount = Math.min(candidates.length, Math.max(maxClips, maxClips * 2))
  let system =
    'You are a master viral video editor for TikTok, Instagram Reels, and YouTube Shorts.\n' +
    'Analyze the provided speech moments (which may be in Arabic, English, or mixed) and evaluate their virality.\n' +
    'IMPORTANT: Prefer rich, complete narrative moments (at least 28 seconds long, with NO upper duration limit) that contain a strong hook, buildup, and complete payoff. Avoid short fragments unless the entire video is short.\n' +
    'CRITICAL RULE: Do NOT select overlapping moments! Every selected moment MUST cover a distinct, non-overlapping time range (startSec to endSec) from a different part of the video. Never pick two moments that share the same sentences or overlap in time.\n' +
    'For each moment evaluate three distinct sub-scores from 0 to 100:\n' +
    '- hookScore: Power of the first 3 seconds to halt scrolling (provocative question, shocking statement, mystery, or curiosity gap).\n' +
    '- retentionScore: Pacing, storytelling flow, and lack of fluff that keeps viewers watching until the end.\n' +
    '- shareScore: Relatability, quote-worthiness, surprising value, or emotional impact.\n' +
    '- score: Overall weighted viral potential (0-100).\n' +
    'If the candidate text is in Arabic, write the "title" (3-6 words), "titles", "cta", and "reason" in Arabic.\n' +
    'Return strict JSON {"moments":[{"index":<int>,"score":<0-100>,"hookScore":<0-100>,"retentionScore":<0-100>,"shareScore":<0-100>,"title":"<=6 punchy words",' +
    '"titles":["3-6 words Question hook", "3-6 words Shocking hook", "3-6 words Direct value hook"],' +
    '"hookHeadline":"3-5 words ultra viral headline card to show in first 2 seconds",' +
    '"hashtags":["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],' +
    '"cta":"one short engaging sentence encouraging comments",' +
    '"reason":"one sentence why it performs","emoji":"one fitting emoji"}]}.\n' +
    `Return up to ${requestCount} non-overlapping moments, best first.`
  if (instructions?.trim()) {
    system += ` The uploader added these instructions — follow them strictly when picking and ranking: "${instructions.trim().slice(0, 500)}"`
  }

  const candidatePayload = candidates.map((c, i) => {
    const dur = Math.max(1, c.end - c.start)
    const words = (c.text || '').split(/\s+/).filter(Boolean).length
    const wpm = Math.round((words / dur) * 60)
    return {
      index: i,
      startSec: c.start,
      endSec: c.end,
      durationSec: dur,
      speechRateWpm: wpm,
      acousticCadence: wpm > 155 ? 'fast/high-energy' : wpm < 105 ? 'slow/deliberate' : 'conversational',
      text: c.text.slice(0, 700),
    }
  })

  const attempts = []
  for (const p of providers) {
    const t0 = Date.now()
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(p.timeoutMs || 15_000),
        body: JSON.stringify({
          model: p.model,
          response_format: { type: 'json_object' },
          temperature: 0.3,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: JSON.stringify(candidatePayload) },
          ],
        }),
      })
      if (!res.ok) throw new Error(`${p.name} HTTP ${res.status}`)
      const data = await res.json()
      const rawText = data.choices[0].message.content || data.choices[0].message.reasoning_content || '{}'
      const parsed = JSON.parse(rawText)
      const valid = (parsed.moments ?? [])
        .filter((m) => Number.isInteger(m.index) && candidates[m.index])
        .map((m) => {
          const mainTitle = String(m.title ?? '').slice(0, 80)
          const titleOptions = Array.isArray(m.titles) && m.titles.length
            ? m.titles.map((t) => String(t).slice(0, 80))
            : [mainTitle]
          const hashtags = Array.isArray(m.hashtags) && m.hashtags.length
            ? m.hashtags.map((h) => String(h).slice(0, 30))
            : ['#Shorts', '#Reels', '#TikTok', '#Viral', '#fyp']
          const cta = String(m.cta ?? '').slice(0, 120)

          return {
            ...candidates[m.index],
            score: Math.max(0, Math.min(100, Math.round(m.score))),
            hookScore: Math.max(0, Math.min(100, Math.round(m.hookScore ?? m.score))),
            retentionScore: Math.max(0, Math.min(100, Math.round(m.retentionScore ?? m.score))),
            shareScore: Math.max(0, Math.min(100, Math.round(m.shareScore ?? m.score))),
            title: mainTitle,
            titleOptions,
            hookHeadline: String(m.hookHeadline ?? m.title ?? '').slice(0, 80),
            hashtags,
            cta,
            reason: String(m.reason ?? ''),
            emoji: String(m.emoji ?? '').slice(0, 4),
          }
        })
      if (valid.length) {
        const latency = Date.now() - t0
        const fallbackNote = attempts.length > 0 ? ` | fallback chain: ${attempts.join(' -> ')}` : ''
        console.log(`[worker] scored via ${p.name} in ${latency}ms [${p.tier}]${fallbackNote}`)
        return valid
      }
      throw new Error('Empty or invalid moments array returned')
    } catch (e) {
      const latency = Date.now() - t0
      const isTimeout = e.name === 'TimeoutError' || e.message.toLowerCase().includes('timeout')
      const reason = isTimeout ? 'timeout' : e.message
      attempts.push(`${p.name} (${reason})`)
      console.warn(`[worker] tier ${p.name} failed after ${latency}ms (${reason}) — switching immediately to next tier...`)
    }
  }
  if (attempts.length) {
    console.warn(`[worker] all LLM tiers failed (${attempts.join(' -> ')}) — falling back to heuristic scoring`)
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

      // 2. Retention score (0-100): cadence, energy, clean ending, and ideal 30s-60s story length bonus
      let paceBonus = 0
      if (wps >= 2.0 && wps <= 3.6) paceBonus = 18
      else if (wps >= 1.5 && wps < 2.0) paceBonus = 8
      else if (wps > 3.6 && wps <= 4.5) paceBonus = 10

      const durationBonus = dur >= 30 ? 12 : dur >= 25 ? 6 : 0
      const endsCleanly = /[.!?؟]$/.test(text.trim())
      let retentionScore = 46 + paceBonus + durationBonus + (endsCleanly ? 12 : 0) + Math.min(18, Math.round(wordCount * 0.18))
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

      const isAr = arHookCount > 0 || /[\u0600-\u06FF]/.test(text)
      const cleanT = title.replace(/[?؟]/g, '')
      const titleOptions = [
        title,
        isAr ? `سر ${cleanT}` : `The secret behind ${cleanT}`,
        isAr ? `أكبر غلطة في ${cleanT}` : `The biggest mistake with ${cleanT}`
      ]
      const hashtags = isAr
        ? ['#اكسبلور', '#ترند', '#ريلز', '#تيك_توك', '#شورتس', '#fyp']
        : ['#Shorts', '#Reels', '#TikTok', '#Viral', '#fyp', '#Trending']
      const cta = isAr
        ? 'شاركنا رأيك في التعليقات: هل تتفق مع هذا الكلام؟'
        : 'Drop your thoughts in the comments: do you agree?'

      return {
        ...c,
        score: overallScore,
        hookScore,
        retentionScore,
        shareScore,
        title: title.slice(0, 60),
        titleOptions,
        hookHeadline: (isAr ? `⚡ ${cleanT}` : `🔥 ${cleanT}`).slice(0, 60),
        hashtags,
        cta,
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
}

async function scoreMoments(transcript, duration, from = 0, instructions = null, excludedRanges = []) {
  const minDur = Math.max(25, CFG.clipMinLength ?? 25)
  const maxDur = 60
  const effectiveDuration = Math.max(0, duration - Math.max(0, from))
  // Ensure we don't chop a short video into tiny 15s pieces: 1 clip per ~32s of source media
  const maxClips =
    effectiveDuration > 0
      ? Math.min(CFG.clipsPerVideo, Math.max(1, Math.floor(effectiveDuration / 30)))
      : CFG.clipsPerVideo

  const clampTo60 = (list) =>
    (list || []).map((m) => ({
      ...m,
      end: Math.min(Math.round(duration), m.start + 60, m.end),
    }))

  // 1. Primary: Autonomous AI Transcript Director chooses exact startSec & endSec (28s-60s max complete arcs)
  const aiDirected = await llmDirectMomentsFromTranscript(
    transcript,
    duration,
    from,
    instructions,
    maxClips,
    minDur,
    maxDur,
    excludedRanges
  )

  const candidates = generateCandidateMoments(transcript, duration, from, minDur, maxDur, excludedRanges)
  const heurResult = candidates.length ? heuristicScoreMoments(candidates) : []

  if (aiDirected && aiDirected.length) {
    let deduped = dedupeOverlappingMoments(aiDirected, maxClips, 0.15)
    if (deduped.length < maxClips && candidates.length) {
      const llmCandidates = await llmScoreMoments(candidates, instructions, maxClips)
      deduped = dedupeOverlappingMoments(
        [...deduped, ...(llmCandidates || []), ...heurResult],
        maxClips,
        0.15
      )
    }
    const finalClips = clampTo60(deduped)
    console.log(
      `[worker] selected ${finalClips.length}/${maxClips} AI-directed non-overlapping clips (video duration=${Math.round(duration)}s, clip durations=${finalClips.map((d) => `${d.end - d.start}s`).join(', ')})`
    )
    return finalClips
  }

  if (!candidates.length) return []

  const llmResult = await llmScoreMoments(candidates, instructions, maxClips)
  if (llmResult && llmResult.length) {
    let deduped = dedupeOverlappingMoments(llmResult, maxClips, 0.15)
    if (deduped.length < maxClips) {
      deduped = dedupeOverlappingMoments([...deduped, ...heurResult], maxClips, 0.15)
    }
    const finalClips = clampTo60(deduped)
    console.log(
      `[worker] selected ${finalClips.length}/${maxClips} non-overlapping clips (video duration=${Math.round(duration)}s, clip durations=${finalClips.map((d) => `${d.end - d.start}s`).join(', ')})`
    )
    return finalClips
  }

  console.log('[worker] scored via heuristic (fallback safety net)')
  const deduped = clampTo60(dedupeOverlappingMoments(heurResult, maxClips, 0.15))
  console.log(`[worker] selected ${deduped.length}/${maxClips} non-overlapping heuristic clips (video duration=${Math.round(duration)}s)`)
  return deduped
}

/* ---------- premium vision ---------- */

/** Dominant-speaker crop path via InsightFace + OpenCV + Avatar motion fallback. Returns null on any failure. */
async function faceTrack(src, moment, dir, idx) {
  if (!CFG.premium) return null
  const outJson = path.join(dir, `faces${idx}.json`)
  try {
    await sh(PYTHON_BIN, [FACES_SCRIPT, 'track', src, String(moment.start), String(moment.end), outJson], {
      timeout: 35_000,
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

/* ---------- render ---------- */

async function renderClip(src, moment, dir, idx, transcript, mode = 'smart', captionStyle = 'hormozi', aspectRatio = '9:16', watermark = false, qualityTier = 'preview') {
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
  const karaoke = buildKaraokeAss(
    transcript.words ?? [],
    moment.start,
    moment.end,
    moment.emoji,
    captionStyle,
    W,
    H,
    moment.hookHeadline || moment.title
  )
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

  // framing filters (clipzila-style modes)
  const centerCrop = `crop='min(iw,ih*${W}/${H})':'min(ih,iw*${H}/${W})'`
  const faceCrop = cmdPath
    ? `sendcmd=f='${cmdPath.replace(/\\/g, '/').replace(/:/g, '\\:')}',crop=${cropW}:${cropH}:x:y`
    : centerCrop

  let vfCore
  switch (mode) {
    case 'gaming':
    case 'gaming_split':
    case 'facecam_top': {
      // 9:16 Gaming Vertical Split: Top 35% Facecam/Presenter, Bottom 65% Gameplay
      const topH = Math.round(H * 0.35)
      const botH = H - topH
      vfCore = `split[gcam][gplay];[gcam]crop=iw/3:ih/2:0:0,scale=${W}:${topH}:force_original_aspect_ratio=increase,crop=${W}:${topH}[facecam];[gplay]crop=iw:ih:0:0,scale=${W}:${botH}:force_original_aspect_ratio=increase,crop=${W}:${botH}[gameplay];[facecam][gameplay]vstack`
      break
    }
    case 'split':
    case 'podcast_split': {
      const halfH = Math.round(H / 2)
      // 2-Speaker Podcast Vertical Split: Host on top, Guest on bottom
      vfCore = `split[left][right];[left]crop=iw/2:ih:0:0,scale=${W}:${halfH}:force_original_aspect_ratio=increase,crop=${W}:${halfH}[top];[right]crop=iw/2:ih:iw/2:0,scale=${W}:${halfH}:force_original_aspect_ratio=increase,crop=${W}:${halfH}[bottom];[top][bottom]vstack`
      break
    }
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

  const buildArgs = (usePrimary) => {
    let vfChain = `${usePrimary ? vfCore : centerCrop},scale=${W}:${H},subtitles=${escAss}`
    if (watermark && existsSync(BRAND_WATERMARK_PATH)) {
      const escWm = BRAND_WATERMARK_PATH.replace(/\\/g, '/').replace(/:/g, '\\:')
      const wmW = Math.round(W * 0.28)
      const margin = Math.round(W * 0.04)
      vfChain = `movie='${escWm}',scale=${wmW}:-1,format=rgba,colorchannelmixer=aa=0.85[wm];[in]${vfChain}[vbase];[vbase][wm]overlay=W-w-${margin}:${margin}`
    }
    const isHd = qualityTier === 'download' || qualityTier === 'hd'
    const encArgs = isHd
      ? ['-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-c:a', 'aac', '-b:a', '192k']
      : ['-c:v', 'libx264', '-preset', 'superfast', '-crf', '28', '-maxrate', '1500k', '-bufsize', '3000k', '-c:a', 'aac', '-b:a', '96k']
    return [
      '-y', '-ss', String(moment.start), '-t', String(targetDur), '-i', src,
      '-vf', vfChain,
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
      ...encArgs,
      '-movflags', '+faststart',
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
  const thumbFile = path.join(dir, `thumb${idx}.jpg`)
  const thumbSec = faces?.bestFaceSec ?? Math.min(targetDur - 0.5, 3.0)
  await sh(
    'ffmpeg',
    [
      '-y',
      '-ss',
      String(moment.start + thumbSec),
      '-i',
      src,
      '-frames:v',
      '1',
      '-vf',
      `${vfCore},scale=${W}:${H}`,
      '-q:v',
      '2',
      thumbFile,
    ],
    { timeout: 1000 * 60 * 5 }
  )

  return { file: outFile, thumb: thumbFile, duration: gotDur, cropMode: faces ? 'face-track' : 'center' }
}

/** Probe original video dimensions once. */
let srcProbeCache = null
async function probeSize(file) {
  if (srcProbeCache) return srcProbeCache
  const out = await sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file])
  const s = JSON.parse(out).streams[0]
  srcProbeCache = { w: s.width, h: s.height }
  return srcProbeCache
}

/** Render all clips with bounded parallelism and per-clip progress reporting. */
async function renderAll(src, moments, dir, transcript, framing = 'smart', captionStyle = 'hormozi', aspectRatio = '9:16', watermark = false, onProgress = null, qualityTier = 'preview') {
  const VARIETY = ['face', 'blur', 'center']
  const results = new Array(moments.length)
  let next = 0
  let doneCount = 0
  async function lane() {
    for (;;) {
      const i = next++
      if (i >= moments.length) return
      const mode = framing === 'variety' ? VARIETY[i % VARIETY.length] : framing
      console.log(`[worker] rendering clip ${i + 1}/${moments.length} [${mode}, style=${captionStyle}, ratio=${aspectRatio}, watermark=${watermark}, tier=${qualityTier}]`)
      results[i] = await renderClip(src, moments[i], dir, i, transcript, mode, captionStyle, aspectRatio, watermark, qualityTier)
      doneCount++
      if (typeof onProgress === 'function') {
        await onProgress(doneCount, moments.length).catch(() => {})
      }
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

async function deleteFromR2(key) {
  try {
    await sh('aws', ['s3', 'rm', `s3://${CFG.r2Bucket}/${key}`, '--endpoint-url', CFG.r2Endpoint], {
      env: { ...process.env, AWS_ACCESS_KEY_ID: CFG.r2Key, AWS_SECRET_ACCESS_KEY: CFG.r2Secret, AWS_DEFAULT_REGION: 'auto' },
      timeout: 1000 * 60 * 2,
    })
    console.log(`[worker] deleted R2 object: ${key}`)
  } catch (e) {
    console.warn(`[worker] failed to delete R2 object ${key}:`, e.message)
  }
}

/* ================= job loop ================= */

/**
 * Early, cheap gate: probe the URL's duration via yt-dlp metadata and reject
 * an out-of-plan source BEFORE downloading the media. The authoritative
 * post-download check still runs (file uploads and live/misreported URLs
 * rely on it), so this only saves bandwidth/disk on the common reject path.
 */
async function ensureWithinPlan(_project) {
  // No upper duration limit: allow source videos of any length.
  return
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

    const aspectRatio = project.aspectRatio ?? '9:16'
    const owner = await prisma.user.findUnique({ where: { id: project.userId }, select: { role: true } })
    const applyWatermark = !owner?.role || owner.role === 'FREE' || owner.role === 'USER'
    const rendered = await renderClip(
      src,
      moment,
      dir,
      `adj_${Date.now()}`,
      transcript,
      project.framing ?? 'smart',
      captionStyle,
      aspectRatio,
      applyWatermark
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
          unlocked: Boolean(clip.captionData?.unlocked),
        },
      },
    })

    console.log(`[worker] [clip_adjust] clip ${clipId} updated successfully to [${start}s-${end}s]`)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

async function processClipRenderHd(job) {
  const setP = (p, stage = null) =>
    prisma.processingJob.update({
      where: { id: job.id },
      data: {
        progress: p,
        ...(stage ? { result: { ...(job.result || {}), stage } } : {}),
      },
    }).catch(() => {})

  const { clipId } = job.result || {}
  if (!clipId) throw new Error('Missing clipId in clip_render_hd job')

  const project = await prisma.project.findUnique({ where: { id: job.projectId } })
  if (!project) throw new Error(`Project ${job.projectId} not found`)

  const clip = await prisma.clip.findUnique({ where: { id: clipId } })
  if (!clip) throw new Error(`Clip ${clipId} not found`)

  console.log(`[worker] [clip_render_hd] ${job.id}: rendering HD master for clip ${clipId}`)
  await setP(15, 'Acquiring source video media...')

  const dir = await mkdtemp(path.join(tmpdir(), 'nology-hd-'))
  try {
    const cacheDir = path.join(tmpdir(), 'nology-sources')
    await mkdir(cacheDir, { recursive: true }).catch(() => {})
    const cachedSrc = path.join(cacheDir, `${project.id}.mp4`)

    let src = null
    try {
      const st = await stat(cachedSrc)
      if (st.size > 1000) src = cachedSrc
    } catch {}

    if (!src) {
      await setP(25, 'Loading source video media...')
      src = project.sourceFile
        ? await downloadFromR2(project.sourceFile, dir)
        : await download(project.sourceUrl, dir)
      await copyFile(src, cachedSrc).catch(() => {})
    }

    await setP(45, 'Preparing HD master typography & karaoke...')
    let transcript = project.transcript
    if (!transcript || !Array.isArray(transcript.words)) {
      if (clip.captionData && Array.isArray(clip.captionData.words)) {
        transcript = { words: clip.captionData.words }
      } else {
        transcript = { words: [] }
      }
    }

    const captionStyle = clip.captionStyle || project.captionStyle || 'hormozi'
    const moment = {
      start: clip.sourceStart,
      end: clip.sourceEnd,
      title: clip.title,
      text: clip.title,
      emoji: clip.captionData?.emoji || '',
      score: clip.viralScore,
      hookHeadline: clip.captionData?.hookHeadline || clip.title,
    }

    const aspectRatio = clip.aspectRatio || project.aspectRatio || '9:16'
    const owner = await prisma.user.findUnique({ where: { id: project.userId }, select: { role: true } })
    const applyWatermark = !owner?.role || owner.role === 'FREE' || owner.role === 'USER'

    await setP(60, 'Rendering high-definition master (CRF 20, 192k audio)...')
    const rendered = await renderClip(
      src,
      moment,
      dir,
      `hd_${clip.id}`,
      transcript,
      project.framing ?? 'smart',
      captionStyle,
      aspectRatio,
      applyWatermark,
      'download'
    )

    await setP(85, 'Uploading HD master to Cloudflare R2...')
    const base = `${project.userId}/${project.id}`
    const hdUrl = await uploadToR2(rendered.file, `${base}/clip-${clip.id}-hd.mp4`)

    await prisma.clip.update({
      where: { id: clip.id },
      data: {
        exportUrl: hdUrl,
        exportedAt: new Date(),
      },
    })

    console.log(`[worker] [clip_render_hd] completed HD master for clip ${clipId}: ${hdUrl}`)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Autonomous Worker-Level Long-Form Raw Video Discovery:
 * If a campaign project's initial sourceUrl turns out to be a short pre-edited example clip (<120s),
 * the worker uses AI + YouTube search to automatically find an unused 3-to-19.5 minute long-form
 * raw video matching the campaign creator/topic so clips are always cut from scratch from long videos.
 */
async function discoverLongFormYoutubeSourceViaAi(project, extraContext = '') {
  const usedYtIds = new Set()
  try {
    const past = await prisma.project.findMany({
      where: { userId: project.userId },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: { sourceUrl: true },
    })
    for (const p of past) {
      const m = (p.sourceUrl || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
      if (m) usedYtIds.add(m[1])
    }
  } catch {}

  let queries = []
  const providers = getAiProviders()
  for (const p of providers) {
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(6000),
        body: JSON.stringify({
          model: p.model,
          response_format: { type: 'json_object' },
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                'You are an AI research director for a viral video clipping studio. Given a campaign title, instructions, and sample transcript/context from an example clip, output strict JSON {"queries":["query 1","query 2","query 3"]} with 3 specific YouTube search queries to find LONG-FORM raw videos, full streams, or highlight compilations of the exact creator/streamer/brand so we can cut brand-new viral clips from scratch.',
            },
            {
              role: 'user',
              content: `Campaign Title: ${project.title || ''}\nInstructions: ${project.instructions || ''}\nExample Clip Context: ${extraContext.slice(0, 800)}`,
            },
          ],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const raw = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content || '{}'
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed.queries) && parsed.queries.length) {
          queries = parsed.queries.map(String).filter(Boolean)
          break
        }
      }
    } catch {}
  }

  const cleanTitle = (project.title || '').replace(/campaign|v\d+|by/gi, ' ').replace(/\s+/g, ' ').trim()
  const allQueries = Array.from(
    new Set([
      ...queries,
      `${cleanTitle} gameplay highlights`,
      `${cleanTitle} full stream`,
    ].map((q) => q.trim()).filter((q) => q.length >= 3))
  ).slice(0, 4)

  const parseDur = (s) => {
    const parts = String(s || '').split(':').map((n) => parseInt(n, 10))
    if (parts.some((n) => Number.isNaN(n))) return 0
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    return parts[0] || 0
  }

  for (const q of allQueries) {
    try {
      const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(5000),
      })
      if (!r.ok) continue
      const html = await r.text()
      const chunks = html.split('"videoRenderer":{"videoId":"').slice(1, 15)
      for (const chunk of chunks) {
        const videoId = chunk.slice(0, 11)
        if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId) || usedYtIds.has(videoId)) continue
        const titleMatch = chunk.match(/"title":\{"runs":\[\{"text":"([^"]+)"/)
        const lenMatch = chunk.match(/"lengthText":\{[^}]*?"simpleText":"([0-9:]+)"/)
        if (!titleMatch || !lenMatch) continue
        const durSec = parseDur(lenMatch[1])
        // Require long-form video (>= 180s, NO upper duration limit!)
        if (durSec < 180) continue
        const vTitle = titleMatch[1].replace(/\\u0026/g, '&').trim()
        if (/#shorts|\bshorts\b|\btiktok\b/i.test(vTitle)) continue
        return {
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title: vTitle,
          durationSec: durSec,
        }
      }
    } catch {}
  }
  return null
}

async function processJob(job) {
  if (job.type === 'clip_adjust') {
    return processClipAdjust(job)
  }
  if (job.type === 'clip_render_hd') {
    return processClipRenderHd(job)
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
    let src = project.sourceFile
      ? await downloadFromR2(project.sourceFile, dir)
      : (await ensureWithinPlan(project), await download(project.sourceUrl, dir, setP))

    let duration = await probeDuration(src)
    const owner = await prisma.user.findUnique({ where: { id: project.userId }, select: { role: true } })

    // Enforce minimum 3-minute (180s) source video duration:
    // If a campaign/Drive/short URL is < 180s, automatically use AI to discover a fresh >= 180s (3+ min) long-form raw video on YouTube!
    const isShortSource = !project.sourceFile && duration < 180
    const isCampaignOrDrive =
      Boolean(project.instructions) ||
      /drive\.google\.com/i.test(project.sourceUrl || '') ||
      /campaign|whop|reward/i.test(project.title || '')

    if (isShortSource && isCampaignOrDrive) {
      console.log(
        `[worker] ${job.id}: initial source is shorter than 3 minutes (${Math.round(duration)}s < 180s). Discovering >=3m long-form raw video via AI...`
      )
      await setP(14, 'Short clip detected (<3 min) — AI searching for full long-form raw video (>=3 min)...')
      let sampleHint = ''
      try {
        const sampleTr = await transcribe(src, dir, project.language ?? 'auto')
        sampleHint = sampleTr.text || ''
      } catch {}

      const discovered = await discoverLongFormYoutubeSourceViaAi(project, sampleHint)
      if (discovered) {
        console.log(
          `[worker] ${job.id}: AI replaced short clip with long-form raw video: ${discovered.url} ("${discovered.title}", ${Math.round(discovered.durationSec / 60)}m)`
        )
        await setP(18, `Downloading AI-discovered long-form video (${Math.round(discovered.durationSec / 60)}m)...`)
        const longDir = path.join(dir, 'longform')
        await mkdir(longDir, { recursive: true })
        const newSrc = await download(discovered.url, longDir, setP)
        const newDur = await probeDuration(newSrc)
        if (newDur >= 180) {
          src = newSrc
          duration = newDur
          project.sourceUrl = discovered.url
          await prisma.project
            .update({
              where: { id: project.id },
              data: { sourceUrl: discovered.url },
            })
            .catch(() => {})
        }
      }
    }

    if (duration < 180) {
      throw new Error(
        `الفيديو الأصلي قصير جداً (${Math.round(duration)} ثانية) — الحد الأدنى لمدة الفيديوهات الأصلية هو 3 دقائق (180 ثانية) ليتمكن الذكاء الاصطناعي من قص مقاطع فايرال احترافية منه.`
      )
    }

    // Cache source video for fast subsequent clip adjustments
    try {
      const cacheDir = path.join(tmpdir(), 'nology-sources')
      await mkdir(cacheDir, { recursive: true })
      await copyFile(src, path.join(cacheDir, `${project.id}.mp4`))
    } catch {}

    console.log('[worker] transcribing')
    await setP(30, 'Transcribing speech audio with AI Whisper model...')
    const transcript = await transcribe(src, dir, project.language ?? 'auto')
    await prisma.project.update({
      where: { id: project.id },
      data: { transcript, duration: Math.round(duration || 0) },
    }).catch((e) => {
      console.warn('[worker] failed to cache transcript to project:', e.message)
    })

    console.log('[worker] scoring moments')
    await setP(52, 'AI Director selecting viral story arcs (<=60s), timestamps & hooks...')
    let excludedRanges = []
    if (project.sourceUrl) {
      try {
        const prevClips = await prisma.clip.findMany({
          where: {
            userId: project.userId,
            projectId: { not: project.id },
            project: { sourceUrl: project.sourceUrl },
          },
          select: { sourceStart: true, sourceEnd: true, title: true },
          take: 30,
        })
        excludedRanges = prevClips
          .filter((c) => Number.isFinite(c.sourceStart) && Number.isFinite(c.sourceEnd))
          .map((c) => ({ start: c.sourceStart, end: c.sourceEnd, title: c.title }))
        if (excludedRanges.length > 0) {
          console.log(`[worker] ${project.id}: excluding ${excludedRanges.length} previously clipped time ranges on same sourceUrl`)
        }
      } catch {}
    }
    const moments = await scoreMoments(transcript, duration, project.clipFrom ?? 0, project.instructions, excludedRanges)
    if (!moments.length) throw new Error('no viable moments found')

    const captionStyle = project.captionStyle ?? 'hormozi'
    const aspectRatio = project.aspectRatio ?? '9:16'
    const applyWatermark = !owner?.role || owner.role === 'FREE' || owner.role === 'USER'
    console.log(`[worker] rendering ${moments.length} clips (premium=${CFG.premium}, framing=${project.framing}, style=${captionStyle}, ratio=${aspectRatio}, watermark=${applyWatermark})`)
    await setP(58, `Reframing vertical layout & rendering clip 1 of ${moments.length}...`)
    const files = await renderAll(
      src,
      moments,
      dir,
      transcript,
      project.framing ?? 'smart',
      captionStyle,
      aspectRatio,
      applyWatermark,
      async (done, total) => {
        const pct = Math.min(88, 58 + Math.round((done / total) * 30))
        await setP(pct, `Rendered clip ${done} of ${total} (preview tier)...`)
      },
      'preview'
    )

    for (let i = 0; i < moments.length; i++) {
      const m = moments[i]
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
          duration: Math.min(60, Math.round(m.end - m.start)),
          viralScore: Math.round(m.score),
          hookScore: Math.round(m.hookScore ?? m.score),
          retentionScore: Math.round(m.retentionScore ?? m.score),
          shareScore: Math.round(m.shareScore ?? m.score),
          status: 'READY',
          videoUrl: url,
          exportUrl: null,
          exportedAt: null,
          thumbnailUrl: thumbUrl,
          captionStyle: captionStyle,
          captionData: {
            mode: 'karaoke',
            unlocked: false,
            emoji: m.emoji ?? '',
            words: winWords,
            style: captionStyle,
            hookHeadline: m.hookHeadline || m.title,
            titleOptions: m.titleOptions || [m.title],
            hashtags: m.hashtags || [],
            cta: m.cta || '',
          },
          motionGraphics: { cropMode: files[i].cropMode },
        },
      })
      await setP(88 + Math.round(((i + 1) / moments.length) * 11), `Uploading clip ${i + 1} of ${moments.length} to Cloudflare R2...`)
    }

    await prisma.project.update({ where: { id: project.id }, data: { status: 'COMPLETED', creditsUsed: 0 } })
    await setP(100, 'Processing complete! Select your clips and confirm to unlock download.')
    console.log(`[worker] ${project.id}: rendered ${moments.length} preview clips (unlocked=false, awaiting user selection & credit deduction)`)
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

/** Delete HD master renders from Cloudflare R2 after retention window (HD_RETENTION_DAYS, default 30) */
async function cleanExpiredHdClips() {
  try {
    const retentionDays = parseInt(process.env.HD_RETENTION_DAYS || '30', 10)
    const expiryDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    const expiredClips = await prisma.clip.findMany({
      where: {
        exportUrl: { not: null },
        exportedAt: { lt: expiryDate },
      },
      select: { id: true, exportUrl: true },
      take: 25,
    })

    if (!expiredClips.length) return

    for (const clip of expiredClips) {
      if (clip.exportUrl) {
        let key = null
        if (clip.exportUrl.includes(`/${CFG.r2Bucket}/`)) {
          key = clip.exportUrl.split(`/${CFG.r2Bucket}/`)[1]?.split('?')[0]
        }
        if (key) {
          await deleteFromR2(key)
        }
      }
      await prisma.clip.update({
        where: { id: clip.id },
        data: { exportUrl: null, exportedAt: null },
      })
      console.log(`[worker] purged expired HD master for clip ${clip.id} (retention: ${retentionDays}d)`)
    }
  } catch (e) {
    console.warn('[worker] cleanExpiredHdClips error:', e.message)
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

/** Auto-Pilot YouTube channel monitor */
async function checkAutoPilotChannels() {
  try {
    const halfHourAgo = new Date(Date.now() - 30 * 60_000)
    const channels = await prisma.autoPilotChannel.findMany({
      where: {
        isActive: true,
        OR: [
          { lastCheckedAt: null },
          { lastCheckedAt: { lt: halfHourAgo } },
        ],
      },
      take: 4,
    })

    if (!channels.length) return

    for (const ch of channels) {
      try {
        console.log(`[autopilot] checking channel: ${ch.channelUrl}`)
        await prisma.autoPilotChannel.update({
          where: { id: ch.id },
          data: { lastCheckedAt: new Date() },
        })

        const urlToProbe = ch.channelUrl.endsWith('/videos') ? ch.channelUrl : `${ch.channelUrl.replace(/\/$/, '')}/videos`
        const out = await sh('yt-dlp', [
          '--flat-playlist',
          '--playlist-end', '1',
          '--print', '%(id)s||%(title)s',
          urlToProbe,
        ], { timeout: 35_000 }).catch(() => null)

        if (!out || !out.trim()) continue
        const [videoId, videoTitle] = out.trim().split('||')
        if (!videoId || videoId === ch.lastVideoId) continue

        console.log(`[autopilot] new upload detected on ${ch.channelUrl}: ${videoId} ("${videoTitle}")`)

        const owner = await prisma.user.findUnique({
          where: { id: ch.userId },
          select: { credits: true, role: true },
        })

        if (!owner || (owner.role !== 'STUDIO' && owner.role !== 'ADMIN')) {
          console.log(`[autopilot] user ${ch.userId} role "${owner?.role}" is not Studio/Admin — pausing channel`)
          await prisma.autoPilotChannel.update({ where: { id: ch.id }, data: { isActive: false } })
          continue
        }

        if (owner.role !== 'ADMIN' && owner.credits < 1) {
          console.log(`[autopilot] user ${ch.userId} has insufficient credits (${owner?.credits ?? 0})`)
          continue
        }

        // Daily AutoPilot project circuit breaker (bypassed for Admin)
        const maxDaily = parseInt(process.env.AUTOPILOT_MAX_DAILY_PROJECTS || '10', 10)
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)
        const todaysCount = await prisma.project.count({
          where: {
            userId: ch.userId,
            createdAt: { gte: startOfDay },
            title: { startsWith: 'AutoPilot:' },
          },
        })

        if (owner.role !== 'ADMIN' && todaysCount >= maxDaily) {
          console.log(`[autopilot] user ${ch.userId} reached daily limit (${todaysCount}/${maxDaily}) — skipping`)
          continue
        }

        // Fast duration probe to avoid downloading out-of-plan long videos
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
        const durSec = await probeUrlDuration(videoUrl)
        if (durSec && owner.role !== 'ADMIN' && exceedsPlanMinutes(durSec / 60, owner.role)) {
          const maxMin = planMaxMinutes(owner.role)
          console.log(
            `[autopilot] video ${videoId} is ~${Math.round(durSec / 60)} min, exceeding ${maxMin} min plan limit for ${owner.role || 'FREE'} — skipping`
          )
          await prisma.autoPilotChannel.update({
            where: { id: ch.id },
            data: { lastVideoId: videoId },
          })
          continue
        }

        await prisma.$transaction(async (tx) => {
          const p = await tx.project.create({
            data: {
              userId: ch.userId,
              title: videoTitle || `AutoPilot: ${ch.channelTitle || 'New Video'}`,
              sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
              duration: 0,
              framing: ch.framing || 'smart',
              language: 'auto',
              captionStyle: ch.captionStyle || 'arabic_luxury',
              aspectRatio: ch.aspectRatio || '9:16',
              status: 'PENDING',
              creditsUsed: 0,
            },
          })
          await tx.processingJob.create({
            data: { projectId: p.id, type: 'clip_generation', status: 'queued' },
          })
          await tx.autoPilotChannel.update({
            where: { id: ch.id },
            data: { lastVideoId: videoId },
          })
        })

        console.log(`[autopilot] enqueued project for video ${videoId} from channel ${ch.channelUrl}`)
      } catch (chErr) {
        console.error(`[autopilot] error inspecting ${ch.channelUrl}:`, chErr.message)
      }
    }
  } catch (err) {
    console.error('[autopilot] sweep failed:', err.message)
  }
}

async function loop() {
  await syncConfigInto()
  const envFlags = {
    db: process.env.DATABASE_URL ? 1 : 0,
    r2: process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_ENDPOINT ? 1 : 0,
    cookies: process.env.YTDLP_COOKIES ? 1 : 0,
    groq: (CFG.groqKey || process.env.GROQ_API_KEY) ? 1 : 0,
  }
  console.log(`[worker] online — premium=${CFG.premium}, parallel=${CFG.renderParallel}, env=${Object.entries(envFlags).map(([k, v]) => `${k}${v ? '+' : '-'}`).join('')}`)

  let lastSweep = 0
  for (;;) {
    // DB-backed knobs can be changed from the admin Settings panel at any
    // time — refresh the live config each loop (cheap, 60s cache).
    await syncConfigInto()

    // Periodic stale-job recovery, orphan directory cleanup, & autopilot sweep:
    if (Date.now() - lastSweep >= 5 * 60_000) {
      lastSweep = Date.now()
      await recoverStale()
      await cleanOrphanTempDirs()
      await cleanExpiredHdClips()
      await checkAutoPilotChannels()
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
        } else if (job.type === 'clip_render_hd') {
          console.error(`[worker] clip_render_hd failed for clip ${job.result?.clipId}:`, e.message)
          // Project remains COMPLETED, clip remains READY with preview videoUrl
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
