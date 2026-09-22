import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, name: true, credits: true, emailVerified: true },
  })
  console.log('--- USERS (' + users.length + ') ---')
  for (const u of users) {
    console.log(`[${u.role}] ${u.email} (id: ${u.id}, verified: ${!!u.emailVerified}, credits: ${u.credits})`)
  }

  const devices = await prisma.device.findMany()
  console.log('--- DEVICES (' + devices.length + ') ---')
  for (const d of devices) {
    console.log(`device: ${d.fingerprintHash} -> userId: ${d.userId} (lastSeen: ${d.lastSeenAt})`)
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())
