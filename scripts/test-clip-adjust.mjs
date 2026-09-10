import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { buildKaraokeAss } from '../worker/caption-styles.mjs'

const run = promisify(execFile)

async function sh(cmd, args) {
  return await run(cmd, args)
}

async function testClipAdjustPipeline() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'clip-adjust-test-'))
  const sourceVideo = path.join(tmp, 'source.mp4')

  console.log('[test] Generating 30s 1920x1080 horizontal source video...')
  await sh('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=44100',
    '-t', '30',
    '-c:v', 'libx264', '-preset', 'ultrafast',
    '-c:a', 'aac',
    sourceVideo,
  ])

  // Mock transcript words across the 30s timeline
  const fullTranscript = {
    words: [
      { text: 'Welcome', start: 1.0, end: 1.8 },
      { text: 'to', start: 1.9, end: 2.2 },
      { text: 'the', start: 2.3, end: 2.5 },
      { text: 'first', start: 2.6, end: 3.1 },
      { text: 'part', start: 3.2, end: 3.7 },
      // Target adjust window: [5s, 22s] (duration: 17s)
      { text: 'Here', start: 5.5, end: 6.0 },
      { text: 'is', start: 6.1, end: 6.4 },
      { text: 'the', start: 6.5, end: 6.8 },
      { text: 'new', start: 6.9, end: 7.2 },
      { text: 'adjusted', start: 7.3, end: 8.0 },
      { text: 'clip', start: 8.1, end: 8.7 },
      { text: 'with', start: 8.8, end: 9.2 },
      { text: 'neon', start: 9.3, end: 9.9 },
      { text: 'captions!', start: 10.0, end: 11.2 },
      { text: 'Everything', start: 14.0, end: 15.0 },
      { text: 'is', start: 15.1, end: 15.4 },
      { text: 'synchronized', start: 15.5, end: 17.0 },
      { text: 'perfectly.', start: 17.5, end: 19.0 },
      // Past target window
      { text: 'This', start: 23.0, end: 23.5 },
      { text: 'is', start: 23.6, end: 24.0 },
      { text: 'outside.', start: 24.1, end: 25.0 },
    ],
  }

  const start = 5.0
  const end = 22.0
  const targetDur = end - start
  const style = 'neon_highlight'

  console.log(`[test] Testing fast trim-only re-render from ${start}s to ${end}s (${targetDur}s) with style=${style}...`)
  const t0 = Date.now()

  // 1. Filter transcript words to [start, end]
  const winWords = fullTranscript.words.filter((w) => w.end > start && w.start < end)
  if (winWords.length === 0) throw new Error('Expected filtered words in window')

  // 2. Generate ASS subtitle file
  const assPath = path.join(tmp, 'adj.ass')
  const assContent = buildKaraokeAss(winWords, start, end, '⚡', style, 1080, 1920)
  await fs.writeFile(assPath, assContent, 'utf8')

  // 3. Fast FFmpeg render (trim + center crop to 9:16 + libass subtitle burn-in)
  const outFile = path.join(tmp, 'adjusted_clip.mp4')
  // Use relative filename so Windows drive letters (C:) don't conflict with FFmpeg filter syntax
  const vfChain = `crop='min(ih*1080/1920,iw)':ih,scale=1080:1920,ass=adj.ass`

  await run('ffmpeg', [
    '-y',
    '-ss', String(start),
    '-t', String(targetDur),
    '-i', 'source.mp4',
    '-vf', vfChain,
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
    '-c:v', 'libx264', '-preset', 'superfast', '-crf', '22',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    'adjusted_clip.mp4',
  ], { cwd: tmp })

  const renderMs = Date.now() - t0
  console.log(`[test] FFmpeg render completed in ${renderMs}ms (< 20,000ms SLA)!`)

  // 4. Probe output video
  const probe = await sh('ffprobe', [
    '-v', 'quiet',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,duration',
    '-of', 'json',
    outFile,
  ])
  const s = JSON.parse(probe.stdout).streams[0]
  const w = Number(s.width)
  const h = Number(s.height)
  const dur = Number(s.duration)

  console.log(`[test] Output Probe: ${w}x${h}, duration=${dur.toFixed(2)}s`)

  // Generate thumbnail
  const thumbPath = path.join(tmp, 'thumb.jpg')
  await sh('ffmpeg', ['-y', '-ss', '2', '-i', outFile, '-frames:v', '1', '-q:v', '2', thumbPath])
  const thumbStat = await fs.stat(thumbPath)

  const success =
    w === 1080 &&
    h === 1920 &&
    Math.abs(dur - targetDur) <= 1.0 &&
    thumbStat.size > 1000 &&
    renderMs < 20000

  if (!success) {
    throw new Error(`QC failed: w=${w}, h=${h}, dur=${dur}, thumbSize=${thumbStat.size}, renderMs=${renderMs}`)
  }

  console.log(`✓ Fast clip adjust test passed in ${renderMs}ms!`)
  console.log(`✓ Words retained: ${winWords.length}/${fullTranscript.words.length}`)

  // Cleanup
  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
  return { success: true, renderMs, width: w, height: h, duration: dur }
}

testClipAdjustPipeline()
  .then((res) => {
    console.log('[test] Summary:', res)
    process.exit(0)
  })
  .catch((err) => {
    console.error('[test] FAILED:', err)
    process.exit(1)
  })
