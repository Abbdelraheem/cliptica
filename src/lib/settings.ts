import { prisma } from '@/lib/prisma'

/**
 * In-memory TTL cache for settings. Settings rarely change, but each read is a
 * round-trip to a remote DB (~1s on a cold Neon connection). Caching turns a
 * page load that reads several settings into a single DB hit.
 */
const cache = new Map<string, { value: string; at: number }>()
const TTL_MS = 30_000

async function getSetting(key: string): Promise<string | null> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) {
    return hit.value
  }
  const row = await prisma.setting.findUnique({ where: { key } })
  const value = row?.value ?? null
  cache.set(key, { value: value ?? '', at: Date.now() })
  return value
}

export function invalidateSetting(key: string) {
  cache.delete(key)
}

/** DB-first numeric setting: Setting table > env fallback > default. */
export async function getSettingNumber(key: string, envFallback?: string, def = 1): Promise<number> {
  const value = await getSetting(key)
  if (value === null) {
    const fromEnv = Number(envFallback)
    return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : def
  }
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : def
}

/** DB-first boolean setting: Setting table > env fallback > default. */
export async function getSettingBool(key: string, envFallback?: string, def = true): Promise<boolean> {
  const value = await getSetting(key)
  if (value === null) {
    if (envFallback === undefined) return def
    const v = envFallback.toLowerCase()
    return v !== '0' && v !== 'false'
  }
  return value === 'true'
}