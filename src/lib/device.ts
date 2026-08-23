import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

export class DeviceConflictError extends Error {
  constructor(message = 'This device is already linked to another account.') {
    super(message)
    this.name = 'DeviceConflictError'
  }
}

export function hashDeviceId(deviceId: string): string {
  return createHash('sha256').update(deviceId).digest('hex')
}

/**
 * Ensures the given device fingerprint is not bound to a DIFFERENT account.
 * `currentUserId` is the account being logged into / created ('__new__' at signup).
 */
export async function assertDeviceAvailable(deviceId: string, currentUserId: string) {
  const fpHash = hashDeviceId(deviceId)
  const owner = await prisma.device.findUnique({ where: { fingerprintHash: fpHash } })
  if (owner && owner.userId !== currentUserId) throw new DeviceConflictError()
}

/** Binds a device to an account (creates the row or refreshes lastSeenAt). */
export async function bindDevice(deviceId: string, userId: string, userAgent?: string | null) {
  const fpHash = hashDeviceId(deviceId)
  await prisma.device.upsert({
    where: { fingerprintHash: fpHash },
    update: { lastSeenAt: new Date(), userAgent: userAgent ?? undefined },
    create: { fingerprintHash: fpHash, userId, userAgent: userAgent ?? undefined },
  })
}
