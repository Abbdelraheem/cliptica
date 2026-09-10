import fs from 'fs/promises'

/**
 * In-memory proxy health tracking.
 * Maps proxy -> { successes, failures, lastAttempt, lastSuccess, quarantinedUntil }
 */
const proxyHealth = new Map()

export function getProxyRecord(proxy) {
  let rec = proxyHealth.get(proxy)
  if (!rec) {
    rec = { successes: 0, failures: 0, lastAttempt: 0, lastSuccess: 0, quarantinedUntil: 0 }
    proxyHealth.set(proxy, rec)
  }
  return rec
}

export function clearProxyHealth() {
  proxyHealth.clear()
}

export function redactProxy(proxy) {
  if (!proxy) return 'direct'
  return proxy.replace(/:([^:@]+)@/, ':***@')
}

export function categorizeDownloadError(err) {
  const msg = (err?.message || String(err || '')).toLowerCase()
  if (
    msg.includes('private video') ||
    msg.includes('unavailable') ||
    msg.includes('does not exist') ||
    msg.includes('deleted')
  ) {
    return 'unavailable'
  }
  if (
    msg.includes("confirm you're not a bot") ||
    msg.includes('bot') ||
    msg.includes('captcha') ||
    msg.includes('recaptcha') ||
    msg.includes('sign in to confirm')
  ) {
    return 'bot-detection'
  }
  if (
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('rate-limit') ||
    msg.includes('rate limit')
  ) {
    return 'rate-limit'
  }
  if (
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('socket timeout') ||
    msg.includes('etimedout') ||
    msg.includes('connection reset') ||
    msg.includes('econnrefused')
  ) {
    return 'network-timeout'
  }
  return 'other'
}

export function recordProxyResult(proxy, success, errorMsg = '') {
  if (!proxy) return
  const rec = getProxyRecord(proxy)
  rec.lastAttempt = Date.now()
  const redacted = redactProxy(proxy)

  if (success) {
    rec.successes += 1
    rec.failures = 0
    rec.lastSuccess = Date.now()
    rec.quarantinedUntil = 0
    console.log(`[proxy-pool] proxy=${redacted} status=SUCCESS total_successes=${rec.successes}`)
  } else {
    rec.failures += 1
    // Quarantine proxy for 15 minutes after 2 consecutive failures
    if (rec.failures >= 2) {
      rec.quarantinedUntil = Date.now() + 15 * 60 * 1000
    }
    const shortErr = String(errorMsg).split('\n')[0].slice(0, 80)
    console.warn(
      `[proxy-pool] proxy=${redacted} status=FAILED failures=${rec.failures} quarantined=${
        rec.quarantinedUntil > Date.now()
      } err="${shortErr}"`
    )
  }
}

export function prioritizeProxies(candidates, envList = [], now = Date.now()) {
  const envSet = new Set(envList)
  const unique = Array.from(new Set(candidates))

  // Filter out quarantined proxies unless they have expired
  const unquarantined = unique.filter((p) => {
    const rec = getProxyRecord(p)
    return rec.quarantinedUntil <= now
  })

  return unquarantined.sort((a, b) => {
    // 1. Paid/env proxies always come first
    const isEnvA = envSet.has(a) ? 1 : 0
    const isEnvB = envSet.has(b) ? 1 : 0
    if (isEnvA !== isEnvB) return isEnvB - isEnvA

    // 2. Score based on successes and failures
    const recA = getProxyRecord(a)
    const recB = getProxyRecord(b)
    const scoreA = recA.successes * 3 - recA.failures
    const scoreB = recB.successes * 3 - recB.failures
    return scoreB - scoreA
  })
}

/**
 * Returns prioritized proxy pool list.
 */
export async function ytProxyPool(options = {}) {
  const envList = (options.envProxies ?? process.env.YTDLP_PROXIES ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  const filePath = options.filePath ?? process.env.YTDLP_PROXIES_FILE ?? '/opt/nology/proxies.txt'
  let fileList = []
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    fileList = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  } catch {
    // File missing or inaccessible: ignore
  }

  const all = [...envList, ...fileList]
  return prioritizeProxies(all, envList, options.now ?? Date.now())
}
