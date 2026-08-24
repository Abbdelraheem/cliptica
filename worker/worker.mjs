/**
 * NOLOGY processing worker
 * Polls ProcessingJob (status=queued) from Neon Postgres and runs:
 *   yt-dlp download -> faster-whisper transcribe -> moment scoring ->
 *   ffmpeg 9:16 cut + caption burn-in -> Cloudflare R2 upload.
 *
 * Runs inside the repo dir so it reuses node_modules (@prisma/client).
 * Usage: pm2 start deploy/ecosystem.config.cjs   (script = worker/worker.mjs)
 */
import { PrismaClient } from '@prisma/client'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

const run = promisify(execFile)
const prisma = new PrismaClient()

const CFG = {
  r2Endpoint: process.env.R2_ENDPOINT, // https://<account>.r2.cloudflarestorage.com
  r2Bucket: process.env.R2_BUCKET ?? 'nology-clips',
  r2Key: process.env.R2_ACCESS_KEY_ID,
  r2Secret: process.env.R2_SECRET_ACCESS_KEY,
  groqKey: process.env.GROQ_API_KEY, // FAST path: ~$0.04/hr audio
  whisperModel: process.env.WHISPER_MODEL ?? 'small', // fallback when no Groq key
  openaiKey: process.env.OPENAI_API_KEY,
  clipsPerVideo: Number(process.env.CLIPS_PER_VIDEO ?? 6),
  clipLength: Number(process.env.CLIP_TARGET_SECONDS ?? 38),
  renderParallel: Number(process.env.RENDER_PARALLEL ?? 4),
}

async function sh(cmd, args, opts) {
  const { stdout } = await run(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...opts })
  return stdout
}

/* ---------- pipeline stages ---------- */

async function download(url, dir) {
  const out = path.join(dir, 'source.%(ext)s')
  await sh('/usr/local/bin/yt-dlp', [
    '-N', '8', // concurrent fragment downloads — ~4x faster
    '-f', 'bv*[height<=1080]+ba/b[height<=1080]',
    '--merge-output-format', 'mp4',
    '-o', out, url,
  ])
  return findFile(dir, /^source\./)
}

function findFile(dir, re) {
  return import('fs/promises').then(async (fs) => {
    for (const f of await fs.readdir(dir)) if (re.test(f)) return path.join(dir, f)
    throw new Error(`file not found: ${re}`)
  })
}

async function probeDuration(file) {
  const out = await sh('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', file])
  return Math.round(JSON.parse(out).format.duration)
}

/** Extract 16kHz mono audio — Groq wants small input; 1hr ≈ 28MB. */
async function extractAudio(file, dir) {
  const mp3 = path.join(dir, 'audio.mp3')
  await sh('ffmpeg', ['-y', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', mp3], {
    timeout: 1000 * 60 * 10,
  })
  return mp3
}

/** FAST path: Groq whisper-large-v3-turbo (~200x realtime). */
async function transcribeGroq(mp3) {
  const form = new FormData()
  const blob = new Blob([await readFile(mp3)])
  form.append('file', blob, 'audio.mp3')
  form.append('model', 'whisper-large-v3-turbo')
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CFG.groqKey}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return {
    language: data.language ?? 'en',
    segments: (data.segments ?? []).map((s) => ({
      start: s.start, end: s.end, text: (s.text ?? '').trim(),
    })),
  }
}

/** Fallback: local faster-whisper (no API key needed, slower). */
async function transcribeLocal(file, dir) {
  const jsonPath = path.join(dir, 'transcript.json')
  await sh('/opt/nology-venv/bin/python', [
    '-c', `
import sys, json
from faster_whisper import WhisperModel
m = WhisperModel(${JSON.stringify(CFG.whisperModel)}, device="cpu", compute_type="int8")
segs, info = m.transcribe(sys.argv[1], word_timestamps=True)
out = [{"start": s.start, "end": s.end, "text": s.text.strip()} for s in segs]
json.dump({"language": info.language, "segments": out}, open(sys.argv[2], "w"))
`, file, jsonPath,
  ], { timeout: 1000 * 60 * 45 })
  return JSON.parse(await readFile(jsonPath, 'utf8'))
}

async function transcribe(file, dir) {
  try {
    if (CFG.groqKey) {
      const t0 = Date.now()
      const mp3 = await extractAudio(file, dir)
      const result = await transcribeGroq(mp3)
      console.log(`[worker] Groq transcription done in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
      return result
    }
  } catch (e) {
    console.error('[worker] Groq failed, falling back to local whisper:', e.message)
  }
  return transcribeLocal(file, dir)
}

/** Score candidate windows; uses OpenAI when key present, else engagement heuristics. */
async function scoreMoments(transcript, duration) {
  const win = CFG.clipLength
  const candidates = []
  for (let s = 0; s + win < duration && candidates.length < 60; s += win / 2) {
    const text = transcript.segments
      .filter((x) => x.start >= s - 2 && x.end <= s + win + 2)
      .map((x) => x.text).join(' ')
      .trim()
    if (text.split(/\s+/).length > 25) candidates.push({ start: Math.round(s), end: Math.round(s + win), text })
  }
  if (!candidates.length) return []

  if (CFG.openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${CFG.openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You rank short-form video moments for virality. Return JSON {"moments":[{"index":0,"score":0-100,"title":"...","reason":"..."}]} — only the strongest.' },
            { role: 'user', content: JSON.stringify(candidates.map((c, i) => ({ index: i, text: c.text.slice(0, 600) }))) },
          ],
        }),
      })
      const data = await res.json()
      const parsed = JSON.parse(data.choices[0].message.content)
      return parsed.moments.slice(0, CFG.clipsPerVideo).map((m) => ({
        ...candidates[m.index], score: m.score, title: m.title, reason: m.reason,
      }))
    } catch (e) {
      console.error('[worker] OpenAI scoring failed, falling back to heuristics:', e.message)
    }
  }

  // Heuristic fallback: hook words + question density + position prior.
  const HOOKS = /\b(secret|never|nobody|mistake|million|why|how|best|worst|stop|truth)\b/gi
  const scored = candidates.map((c) => ({
    ...c,
    score: Math.min(96, 40 + (c.text.match(HOOKS)?.length ?? 0) * 9 + Math.min(15, c.text.split('?').length * 7)),
    title: c.text.split(/\s+/).slice(0, 5).join(' '),
    reason: 'High keyword & question density (heuristic mode)',
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, CFG.clipsPerVideo)
}

const ASS_HEADER = (w, h) => `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Nology,Arial Black,54,&H00FFFFFF,&H00000000,&H88000000,1,1,3,1,2,60,60,120,1

[Events]
Format: Layer, Start, End, Style, Text
`

const tsAss = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s % 1) * 100)).padStart(2, '0')}`

async function renderClip(src, moment, dir, idx) {
  const w = 1080, h = 1920
  const ass = path.join(dir, `cap${idx}.ass`)
  const lines = moment.text.match(/.{1,42}(\s|$)/g) ?? [moment.text]
  let events = ''
  const per = (moment.end - moment.start) / lines.length
  lines.forEach((l, i) => {
    events += `Dialogue: 0,${tsAss(per * i)},${tsAss(per * (i + 1))},Nology,,0,0,0,,${l.trim()}\n`
  })
  await writeFile(ass, ASS_HEADER(w, h) + events)

  const out = path.join(dir, `clip${idx}.mp4`)
  // v1 crop: smart center 9:16 (face-track upgrade lands with worker v2 mediapipe pass)
  await sh('ffmpeg', [
    '-y', '-ss', String(moment.start), '-t', String(moment.end - moment.start), '-i', src,
    '-vf', `crop='min(ih*9/16,iw)':ih,scale=${w}:${h},subtitles=${ass.replace(/\\/g, '/').replace(':', '\\:')}`,
    '-c:v', 'libx264', '-preset', 'superfast', '-crf', '22',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out,
  ], { timeout: 1000 * 60 * 20 })
  return out
}

/** Render N clips with bounded parallelism (default 4 across the ARM cores). */
async function renderAll(src, moments, dir) {
  const results = new Array(moments.length)
  let next = 0
  async function lane() {
    for (;;) {
      const i = next++
      if (i >= moments.length) return
      console.log(`[worker] rendering clip ${i + 1}/${moments.length}`)
      results[i] = await renderClip(src, moments[i], dir, i)
    }
  }
  const lanes = Array.from({ length: Math.min(CFG.renderParallel, moments.length) }, lane)
  await Promise.all(lanes)
  return results
}

async function uploadToR2(file, key) {
  await sh('aws', [
    's3', 'cp', file, `s3://${CFG.r2Bucket}/${key}`,
    '--endpoint-url', CFG.r2Endpoint,
    '--content-type', 'video/mp4',
  ], {
    env: {
      ...process.env,
      AWS_ACCESS_KEY_ID: CFG.r2Key,
      AWS_SECRET_ACCESS_KEY: CFG.r2Secret,
      AWS_DEFAULT_REGION: 'auto',
    },
    timeout: 1000 * 60 * 15,
  })
  return `${CFG.r2Endpoint}/${CFG.r2Bucket}/${key}`
}

/* ---------- job loop ---------- */

async function processJob(job) {
  const project = await prisma.project.findUnique({ where: { id: job.projectId } })
  if (!project?.sourceUrl) throw new Error('project has no sourceUrl')

  const setP = (p) => prisma.processingJob.update({ where: { id: job.id }, data: { progress: p } })
  await prisma.project.update({ where: { id: project.id }, data: { status: 'PROCESSING' } })

  const dir = await mkdtemp(path.join(tmpdir(), 'nology-'))
  try {
    console.log(`[worker] ${job.id}: downloading`)
    await setP(10)
    const src = await download(project.sourceUrl, dir)
    const duration = await probeDuration(src)

    console.log(`[worker] ${job.id}: transcribing (${duration}s audio)`)
    await setP(35)
    const transcript = await transcribe(src, dir)

    console.log('[worker] scoring moments')
    await setP(55)
    const moments = await scoreMoments(transcript, duration)
    if (!moments.length) throw new Error('no viable moments found')

    console.log(`[worker] rendering ${moments.length} clips in parallel`)
    await setP(58)
    const files = await renderAll(src, moments, dir)

    for (let i = 0; i < moments.length; i++) {
      const m = moments[i]
      const key = `${project.userId}/${project.id}/clip-${i + 1}.mp4`
      const url = await uploadToR2(files[i], key)
      await prisma.clip.create({
        data: {
          projectId: project.id,
          userId: project.userId,
          title: m.title || `Clip ${i + 1}`,
          description: m.reason,
          sourceStart: m.start, sourceEnd: m.end,
          duration: m.end - m.start,
          viralScore: Math.round(m.score),
          status: 'READY',
          videoUrl: url,
          exportUrl: url,
          captionData: { segments: transcript.segments.filter((s) => s.start >= m.start && s.end <= m.end) },
        },
      })
      await setP(60 + Math.round(((i + 1) / moments.length) * 38))
    }
    await prisma.project.update({ where: { id: project.id }, data: { status: 'COMPLETED' } })
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

async function loop() {
  console.log('[worker] online — polling for jobs')
  for (;;) {
    try {
      const job = await prisma.processingJob.findFirst({
        where: { status: 'queued' }, orderBy: { createdAt: 'asc' },
      })
      if (!job) { await new Promise((r) => setTimeout(r, 5000)); continue }
      await prisma.processingJob.update({
        where: { id: job.id }, data: { status: 'processing', startedAt: new Date() },
      })
      try {
        await processJob(job)
        await prisma.processingJob.update({
          where: { id: job.id },
          data: { status: 'completed', progress: 100, completedAt: new Date() },
        })
        console.log(`[worker] ${job.id}: DONE ✔`)
      } catch (e) {
        console.error(`[worker] ${job.id} FAILED:`, e.message)
        await prisma.processingJob.update({
          where: { id: job.id }, data: { status: 'failed', error: e.message },
        }).catch(() => {})
        await prisma.project.update({
          where: { id: job.projectId }, data: { status: 'FAILED' },
        }).catch(() => {})
      }
    } catch (e) {
      console.error('[worker] loop error:', e.message)
      await new Promise((r) => setTimeout(r, 15000))
    }
  }
}

loop()
