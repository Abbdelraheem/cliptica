/**
 * Promotes a user to the ADMIN role (enables the AI motion-graphics
 * controls). Usage: node scripts/set-admin.mjs someone@example.com
 */
import { PrismaClient } from '@prisma/client'

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/set-admin.mjs <email>')
  process.exit(1)
}

const prisma = new PrismaClient()
try {
  const user = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
    select: { id: true, email: true, role: true },
  })
  console.log(`Promoted ${user.email} (${user.id}) to ${user.role}`)
} catch (e) {
  console.error(e.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
