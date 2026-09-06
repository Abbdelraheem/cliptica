import { prisma } from '@/lib/prisma'

/** DB-first numeric setting: Setting table > env fallback > default. */
export async function getSettingNumber(key: string, envFallback?: string, def = 1): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key } })
  if (!row) {
    const fromEnv = Number(envFallback)
    return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : def
  }
  const n = Number(row.value)
  return Number.isFinite(n) && n > 0 ? n : def
}

/** DB-first boolean setting: Setting table > env fallback > default. */
export async function getSettingBool(key: string, envFallback?: string, def = true): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key } })
  if (!row) {
    if (envFallback === undefined) return def
    const v = envFallback.toLowerCase()
    return v !== '0' && v !== 'false'
  }
  return row.value === 'true'
}