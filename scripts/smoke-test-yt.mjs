import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { ytProxyPool, recordProxyResult, redactProxy, categorizeDownloadError } from '../worker/proxy-pool.mjs'

const run = promisify(execFile)
async function sh(cmd, args, opts) {
  const { stdout } = await run(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...opts })
  return stdout
}

function ytdlpArgs(extra) {
  const args = ['--js-runtimes', 'node', '--js-runtimes', 'deno', '--impersonate', 'Safari-18.4']
  if (process.env.YTDLP_COOKIES) args.push('--cookies', process.env.YTDLP_COOKIES)
  return args.concat(extra)
}

async function testDownload(url) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-smoke-'))
  const out = path.join(tmp, 'source.%(ext)s')
  const attempt = (proxy) =>
    sh(
      '/opt/nology-venv/bin/yt-dlp',
      ytdlpArgs([
        ...(proxy ? ['--proxy', proxy] : []),
        '--socket-timeout', '20',
        '-N', '8',
        '-f', 'bv*[height<=1080]+ba/b[height<=1080]/b',
        '--merge-output-format', 'mp4',
        '--max-filesize', '2.5G',
        '--match-filter', 'duration <= 7200',
        '-o', out,
        url,
      ]),
      { timeout: 1000 * 60 * 5 }
    )

  const t0 = Date.now()
  let result = null

  // 1. Direct attempt
  try {
    console.log(`[smoke] Attempting direct download for ${url}...`)
    await attempt(null)
    const dur = Date.now() - t0
    result = { success: true, duration_ms: dur, proxy: 'direct' }
  } catch (e) {
    const dur = Date.now() - t0
    const errType = categorizeDownloadError(e)
    console.log(`[smoke] Direct download failed (${dur}ms, ${errType}): ${e.message.split('\n')[0].slice(0, 80)}`)

    // 2. Proxies
    const proxies = await ytProxyPool()
    console.log(`[smoke] Trying ${proxies.length} proxies...`)
    for (const p of proxies.slice(0, 5)) {
      const p0 = Date.now()
      const red = redactProxy(p)
      try {
        await attempt(p)
        const pdur = Date.now() - p0
        recordProxyResult(p, true)
        result = { success: true, duration_ms: pdur, proxy: red }
        break
      } catch (pe) {
        const pdur = Date.now() - p0
        const pErrType = categorizeDownloadError(pe)
        recordProxyResult(p, false, pe.message)
        console.log(`[smoke] Proxy ${red} failed (${pdur}ms, ${pErrType})`)
      }
    }
  }

  // Clean up
  await fs.rm(tmp, { recursive: true, force: true })

  if (!result) {
    result = { success: false, duration_ms: Date.now() - t0, proxy: 'all_failed' }
  }
  return result
}

const urls = [
  { name: 'short (19s)', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' },
  { name: '5-10m (3m33s)', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { name: 'speech-heavy (15m)', url: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc' },
]

console.log('--- Starting YouTube Smoke Tests ---')
for (const item of urls) {
  console.log(`\nTesting ${item.name}: ${item.url}`)
  const res = await testDownload(item.url)
  console.log(`RESULT: ${item.name} -> success=${res.success} duration=${res.duration_ms}ms proxy=${res.proxy}`)
}
