import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { CAPTION_STYLES, buildKaraokeAss } from '../worker/caption-styles.mjs'

const run = promisify(execFile)

async function sh(cmd, args, opts = {}) {
  return await run(cmd, args, opts)
}

async function runRenderTests() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'style-render-'))

  console.log('Generating test base 9:16 video...')
  await sh('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'color=c=0x161622:s=1080x1920:d=4',
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-shortest',
    'base.mp4',
  ], { cwd: tmp })

  const testWords = [
    { text: 'Look', start: 0.5, end: 1.0 },
    { text: 'at', start: 1.1, end: 1.4 },
    { text: 'this', start: 1.5, end: 1.8 },
    { text: 'Supercalifragilistic', start: 1.9, end: 2.8 },
    { text: 'result! 🚀', start: 2.9, end: 3.8 },
  ]

  const styles = Object.keys(CAPTION_STYLES)
  console.log(`Testing ${styles.length} caption styles rendering through FFmpeg libass...`)

  const results = []
  for (const styleId of styles) {
    const t0 = Date.now()
    const assName = `test-${styleId}.ass`
    const outName = `out-${styleId}.mp4`
    const assFile = path.join(tmp, assName)

    try {
      const assContent = buildKaraokeAss(testWords, 0, 4.0, '✨', styleId, 1080, 1920)
      await fs.writeFile(assFile, assContent, 'utf8')

      await sh('ffmpeg', [
        '-y',
        '-i', 'base.mp4',
        '-vf', `ass=${assName}`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-c:a', 'copy',
        '-t', '3',
        outName,
      ], { cwd: tmp })

      // Probe output
      const probe = await sh('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        outName,
      ], { cwd: tmp })
      const meta = JSON.parse(probe.stdout)
      const vStream = meta.streams.find((s) => s.codec_type === 'video')
      const dur = Date.now() - t0

      results.push({
        styleId,
        name: CAPTION_STYLES[styleId].name,
        success: true,
        width: vStream.width,
        height: vStream.height,
        durationMs: dur,
      })
      console.log(`✓ ${styleId} (${CAPTION_STYLES[styleId].name}) rendered successfully: ${vStream.width}x${vStream.height} in ${dur}ms`)
    } catch (err) {
      results.push({
        styleId,
        name: CAPTION_STYLES[styleId].name,
        success: false,
        error: err.message.split('\n')[0],
      })
      console.error(`✗ ${styleId} failed: ${err.message}`)
    }
  }

  // Clean up
  await fs.rm(tmp, { recursive: true, force: true })

  console.log('\n--- Final Style Rendering Summary ---')
  console.table(results)
}

runRenderTests().catch(console.error)
