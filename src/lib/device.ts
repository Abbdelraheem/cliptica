import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { isAdminEmail } from '@/lib/admin'

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
 * Admins are completely exempt from all device and browser restrictions.
 */
export async function assertDeviceAvailable(
  deviceId: string,
  currentUserId: string,
  userRole?: string | null,
  userEmail?: string | null
) {
  if (userRole === 'ADMIN' || isAdminEmail(userEmail)) return

  if (currentUserId !== '__new__') {
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true, email: true },
    })
    if (user?.role === 'ADMIN' || isAdminEmail(user?.email)) return
  }

  const fpHash = hashDeviceId(deviceId)
  const owner = await prisma.device.findUnique({ where: { fingerprintHash: fpHash } })
  if (owner && owner.userId !== currentUserId) {
    const ownerUser = await prisma.user.findUnique({
      where: { id: owner.userId },
      select: { role: true, email: true },
    })
    // Never block if the device was previously used by an admin or is an admin account
    if (ownerUser?.role === 'ADMIN' || isAdminEmail(ownerUser?.email)) return
    throw new DeviceConflictError()
  }
}

/** Binds a device to an account (creates the row or refreshes lastSeenAt). Admins never constrained. */
export async function bindDevice(
  deviceId: string,
  userId: string,
  userAgent?: string | null,
  userRole?: string | null,
  userEmail?: string | null
) {
  if (userRole === 'ADMIN' || isAdminEmail(userEmail)) return
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  })
  if (user?.role === 'ADMIN' || isAdminEmail(user?.email)) return

  const fpHash = hashDeviceId(deviceId)
  await prisma.device.upsert({
    where: { fingerprintHash: fpHash },
    update: { lastSeenAt: new Date(), userAgent: userAgent ?? undefined },
    create: { fingerprintHash: fpHash, userId, userAgent: userAgent ?? undefined },
  })
}
