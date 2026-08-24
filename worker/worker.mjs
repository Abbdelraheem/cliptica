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
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { calcCredits } from './credits.mjs'

const run = promisify(execFile)
const prisma = new PrismaClient()

const CFG = {
  r2Endpoint: process.env.R2_ENDPOINT,
  r2Bucket: process.env.R2_BUCKET ?? 'nology-clips',
  r2Key: process.env.R2_ACCESS_KEY_ID,
  r2Secret: process.env.R2_SECRET_ACCESS_KEY,

  groqKey: process.env.GROQ_API_KEY,
  openaiKey: process.env.OPENAI_API_KEY,
  whisperModel: process.env.WHISPER_MODEL ?? 'small',

  premium: process.env.PIPELINE_PREMIUM !== '0',
  faceFps: process.env.FACE_FPS ?? '4',
  outW: Number(process.env.OUT_W ?? 1080),
  outH: Number(process.env.OUT_H ?? 1920),
  wordsPerCard: Math.max(1, Math.min(4, Number(process.env.WORDS_PER_CARD ?? 2))),

  clipsPerVideo: Number(process.env.CLIPS_PER_VIDEO ?? 6),
  clipLength: Number(process.env.CLIP_TARGET_SECONDS ?? 38),
  renderParallel: Number(process.env.RENDER_PARALLEL ?? 4),
}

async function sh(cmd, args, opts) {
  const { stdout } = await run(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...opts })
  return stdout
}

/* ================= stages ================= */

const dnsPromises = import('dns/promises')
const net = await import('net')

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      a >= 224
    )
  }
  const v6 = ip.toLowerCase()
  return (
    v6 === '::1' ||
    v6 === '::' ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe80') ||
    v6.startsWith('::ffff:127.')
  )
}

/** SSRF guard — only public http(s) targets may reach yt-dlp. */
async function assertPublicHttpUrl(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed')
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '')
  const dns = await dnsPromises

  const candidates = net.isIP(hostname) ? [hostname] : (await dns.lookup(hostname, { all: true })).map((r) => r.address)
  if (candidates.length === 0) throw new Error('Could not resolve host')

  for (const ip of candidates) {
    if (isPrivateIp(ip)) {
      throw new Error(`Blocked non-public address for host ${hostname}`)
    }
  }
}

async function download(url, dir) {
  await assertPublicHttpUrl(url)
  const out = path.join(dir, 'source.%(ext)s')
  await sh('/usr/local/bin/yt-dlp', [
    '-N', '8',
    '-f', 'bv*[height<=1080]+ba/b[height<=1080]',
    '--merge-output-format', 'mp4',
    '-o', out, url,
  ])
  return findFile(dir, /^source\./)
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
  return transcribeLocal(file, dir)
}

/* ---------- scoring ---------- */

async function llmScoreMoments(candidates, instructions) {
  const providers = []
  if (CFG.groqKey)
    providers.push({ name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: CFG.groqKey, model: process.env.GROQ_SCORE_MODEL ?? 'llama-3.3-70b-versatile' })
  if (CFG.openaiKey)
    providers.push({ name: 'openai', url: 'https://api.openai.com/v1/chat/completions', key: CFG.openaiKey, model: 'gpt-4o-mini' })

  let system =
    'You are a short-form virality expert ranking podcast/video moments for TikTok/Reels/Shorts. ' +
    'Return strict JSON {"moments":[{"index":<int>,"score":<0-100>,"title":"<=6 punchy words",' +
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
        body: JSON.stringify({
          model: p.model,
          response_format: { type: 'json_object' },
          temperature: 0.3,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: JSON.stringify(candidates.map((c, i) => ({ index: i, text: c.text.slice(0, 600) }))) },
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
  const HOOKS = /\b(secret|never|nobody|mistake|million|why|how|best|worst|stop|truth)\b/gi
  return candidates
    .map((c) => ({
      ...c,
      score: Math.min(96, 40 + (c.text.match(HOOKS)?.length ?? 0) * 9 + Math.min(15, c.text.split('?').length * 7)),
      title: c.text.split(/\s+/).slice(0, 5).join(' '),
      reason: 'High keyword & question density',
      emoji: '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CFG.clipsPerVideo)
}

async function scoreMoments(transcript, duration, from = 0, instructions = null) {
  const win = CFG.clipLength
  const candidates = []
  for (let s = Math.max(0, from); s + win < duration && candidates.length < 60; s += win / 2) {
    const text = transcript.segments
      .filter((x) => x.start >= s - 2 && x.end <= s + win + 2)
      .map((x) => x.text).join(' ')
      .trim()
    if (text.split(/\s+/).length > 25) candidates.push({ start: Math.round(s), end: Math.round(s + win), text })
  }
  if (!candidates.length) return []
  return (await llmScoreMoments(candidates, instructions)) ?? heuristicScoreMoments(candidates)
}

/* ---------- premium vision ---------- */

/** Dominant-speaker crop path via InsightFace. Returns null on any failure. */
async function faceTrack(src, moment, dir, idx) {
  if (!CFG.premium) return null
  const outJson = path.join(dir, `faces${idx}.json`)
  try {
    await sh('python3', ['worker/premium/faces.py', 'track', src, String(moment.start), String(moment.end), outJson], {
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

const tsAss = (s) =>
  `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s % 1) * 100)).padStart(2, '0')}`

const ASS_STYLE = (W, H) => `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Pop,Arial Black,${Math.round(W * 0.085)},&H00FFFFFF,&H00000000,&HB4000000,-1,1,${Math.round(W * 0.012)},2,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Text
`

/** Word-pop cards (Hormozi-style): 1-3 big words per card, pop-in animation. */
function buildKaraokeAss(words, start, end, emoji) {
  const W = CFG.outW, H = CFG.outH
  const inWin = words.filter((w) => w.end > start && w.start < end && w.text)
  if (!inWin.length) return null

  const cards = []
  let cur = []
  for (const w of inWin) {
    if (cur.length && w.start - cur[cur.length - 1].end > 0.6) { cards.push(cur); cur = [] }
    cur.push(w)
    if (cur.length >= CFG.wordsPerCard) { cards.push(cur); cur = [] }
  }
  if (cur.length) cards.push(cur)

  let events = ''
  if (emoji) {
    events += `Dialogue: 1,${tsAss(start)},${tsAss(start + 0.8)},Pop,,0,0,0,,{\\fad(80,120)\\pos(${W / 2},${Math.round(H * 0.34)})}${emoji}\n`
  }
  cards.forEach((card, i) => {
    const cs = Math.max(card[0].start, start)
    let ce = i === cards.length - 1 ? Math.min(card[card.length - 1].end, end) : Math.min(card[card.length - 1].end, card[i + 1][0]?.start ?? end)
    if (ce <= cs) ce = cs + 0.35
    const text = card.map((w) => w.text.replace(/[{}]/g, '')).join(' ')
    events +=
      `Dialogue: 0,${tsAss(cs)},${tsAss(ce)},Pop,,0,0,0,,` +
      `{\\fad(50,50)\\t(0,90,\\fscx118\\fscy118)\\t(90,180,\\fscx100\\fscy100)` +
      `\\pos(${W / 2},${Math.round(H * 0.74)})}${text}\n`
  })
  return ASS_STYLE(W, H) + events
}

/** v1 fallback: static phrase lines. */
function buildPhraseAss(text, start, end) {
  const W = CFG.outW, H = CFG.outH
  const lines = text.match(/.{1,42}(\s|$)/g) ?? [text]
  const per = (end - start) / lines.length
  let events = ''
  lines.forEach((l, i) => {
    events += `Dialogue: 0,${tsAss(start + per * i)},${tsAss(start + per * (i + 1))},Pop,,0,0,0,,{\\pos(${W / 2},${Math.round(H * 0.74)})}${l.trim()}\n`
  })
  return ASS_STYLE(W, H) + events
}

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

async function renderClip(src, moment, dir, idx, transcript, mode = 'smart', motion = null) {
  const W = CFG.outW, H = CFG.outH
  const targetDur = moment.end - moment.start

  // captions
  const assPath = path.join(dir, `cap${idx}.ass`)
  const karaoke = buildKaraokeAss(transcript.words ?? [], moment.start, moment.end, moment.emoji)
  await writeFile(assPath, karaoke ?? buildPhraseAss(moment.text, moment.start, moment.end))
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
  const centerCrop = `crop='min(ih*${H}/${W},iw)':ih`
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
  const thumbTs = faces?.thumb_ts ?? moment.start + 3
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
async function renderAll(src, moments, dir, transcript, framing = 'smart', pkgs = null) {
  const VARIETY = ['face', 'blur', 'center']
  const results = new Array(moments.length)
  let next = 0
  async function lane() {
    for (;;) {
      const i = next++
      if (i >= moments.length) return
      const mode = framing === 'variety' ? VARIETY[i % VARIETY.length] : framing
      console.log(`[worker] rendering clip ${i + 1}/${moments.length} [${mode}${pkgs?.[i] ? ' +motion' : ''}]`)
      results[i] = await renderClip(src, moments[i], dir, i, transcript, mode, pkgs?.[i] ?? null)
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

async function processJob(job) {
  const project = await prisma.project.findUnique({ where: { id: job.projectId } })
  if (!project || (!project.sourceUrl && !project.sourceFile)) throw new Error('project has no source')

  const setP = (p) => prisma.processingJob.update({ where: { id: job.id }, data: { progress: p } })
  await prisma.project.update({ where: { id: project.id }, data: { status: 'PROCESSING' } })

  const dir = await mkdtemp(path.join(tmpdir(), 'nology-'))
  try {
    console.log(`[worker] ${job.id}: fetching source (${project.sourceFile ? 'upload' : 'youtube'})`)
    await setP(8)
    const src = project.sourceFile
      ? await downloadFromR2(project.sourceFile, dir)
      : await download(project.sourceUrl, dir)

    console.log('[worker] transcribing')
    await setP(30)
    const transcript = await transcribe(src, dir, project.language ?? 'auto')

    console.log('[worker] scoring moments')
    await setP(52)
    const duration = await probeDuration(src)
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
      await setP(56)
      const llmPacks = await llmMotionPackages(moments).catch(() => null)
      pkgs = moments.map((_, i) => llmPacks?.find((p) => p.index === i) ?? heuristicMotionPack({ ...moments[i], index: i }))
    }

    console.log(`[worker] rendering ${moments.length} clips (premium=${CFG.premium}, framing=${project.framing}${fx ? ' +motion' : ''})`)
    await setP(58)
    const files = await renderAll(src, moments, dir, transcript, project.framing ?? 'smart', pkgs)

    for (let i = 0; i < moments.length; i++) {
      const m = moments[i]
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
          status: 'READY',
          videoUrl: url,
          exportUrl: url,
          thumbnailUrl: thumbUrl,
          captionData: { mode: 'karaoke', emoji: m.emoji ?? '', words: winWords },
          motionGraphics: { ...(files[i].motion ?? { mode: 'none' }), cropMode: files[i].cropMode },
        },
      })
      await setP(62 + Math.round(((i + 1) / moments.length) * 36))
    }

    await prisma.project.update({ where: { id: project.id }, data: { status: 'COMPLETED' } })

    // Charge real usage on completion: 1 credit/min of source video, +2 flat when AI motion was actually applied.
    const creditsSpent = calcCredits(duration, fx)
    await prisma.$transaction([
      prisma.user.update({ where: { id: project.userId }, data: { credits: { decrement: creditsSpent } } }),
      prisma.creditTransaction.create({
        data: {
          userId: project.userId,
          amount: -creditsSpent,
          type: 'usage',
          description: `Clipping "${project.title}" (${Math.round(duration / 60)} min${fx ? ' · AI motion' : ''})`,
          metadata: { projectId: project.id },
        },
      }),
    ])
    await prisma.project.update({ where: { id: project.id }, data: { creditsUsed: creditsSpent } })
    console.log(`[worker] charged ${creditsSpent} credits for ${project.id}`)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

async function loop() {
  console.log(`[worker] online — premium=${CFG.premium}, parallel=${CFG.renderParallel}`)
  for (;;) {
    try {
      const job = await prisma.processingJob.findFirst({ where: { status: 'queued' }, orderBy: { createdAt: 'asc' } })
      if (!job) { await new Promise((r) => setTimeout(r, 5000)); continue }

      await prisma.processingJob.update({ where: { id: job.id }, data: { status: 'processing', startedAt: new Date() } })
      try {
        await processJob(job)
        await prisma.processingJob.update({ where: { id: job.id }, data: { status: 'completed', progress: 100, completedAt: new Date() } })
        console.log(`[worker] ${job.id}: DONE ✔`)
      } catch (e) {
        console.error(`[worker] ${job.id} FAILED:`, e.message)
        await prisma.processingJob.update({ where: { id: job.id }, data: { status: 'failed', error: e.message } }).catch(() => {})
        await prisma.project.update({ where: { id: job.projectId }, data: { status: 'FAILED' } }).catch(() => {})
      }
    } catch (e) {
      console.error('[worker] loop error:', e.message)
      await new Promise((r) => setTimeout(r, 15000))
    }
  }
}

loop()
