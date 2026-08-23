'use client'

/**
 * Device fingerprint — stable across reloads, unique-ish per machine.
 * Combines hardware/display traits + a canvas render hash + a persistent
 * localStorage ID. Sent to the server as one opaque string; the server
 * hashes it so raw values are never stored.
 */

const LS_KEY = 'nlg_device_id'

function canvasHash(): string {
  try {
    const c = document.createElement('canvas')
    c.width = 220
    c.height = 60
    const ctx = c.getContext('2d')
    if (!ctx) return 'nocanvas'
    ctx.textBaseline = 'top'
    ctx.font = "16px 'Arial'"
    ctx.fillStyle = '#f60'
    ctx.fillRect(0, 0, 110, 30)
    ctx.fillStyle = '#069'
    ctx.fillText('NOLOGY·fp·2026', 4, 6)
    ctx.fillStyle = 'rgba(102,204,0,0.7)'
    ctx.fillText('NOLOGY·fp·2026', 6, 18)
    const data = c.toDataURL()
    let h = 0
    for (let i = 0; i < data.length; i++) {
      h = (Math.imul(31, h) + data.charCodeAt(i)) | 0
    }
    return String(h)
  } catch {
    return 'canvas-err'
  }
}

function localId(): string {
  let id = ''
  try {
    id = localStorage.getItem(LS_KEY) ?? ''
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(LS_KEY, id)
    }
  } catch {
    id = `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
  return id
}

export async function getDeviceId(): Promise<string> {
  if (typeof window === 'undefined') return 'server'
  const nav = navigator as Navigator & { deviceMemory?: number }
  const parts = [
    nav.userAgent,
    nav.language,
    (nav.languages ?? []).join(','),
    String(nav.hardwareConcurrency ?? 0),
    String(nav.deviceMemory ?? 0),
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    new Date().getTimezoneOffset(),
    canvasHash(),
    localId(),
  ]
  const raw = parts.join('|')

  // Prefer SHA-256 when available; fall back to a simple digest.
  try {
    if (crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    }
  } catch {
    /* fall through */
  }
  let h1 = 0xdeadbeef ^ raw.length
  let h2 = 0x41c6ce57 ^ raw.length
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${(h2 >>> 0).toString(16)}${(h1 >>> 0).toString(16)}`
}
