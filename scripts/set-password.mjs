import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const email = process.argv[2]
const newPassword = process.argv[3]

if (!email || !newPassword) {
  console.log('Usage: node scripts/set-password.mjs <email> <newPassword>')
  process.exit(1)
}

async function main() {
  const cleanEmail = email.trim().toLowerCase()
  const user = await prisma.user.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' } },
  })

  if (!user) {
    console.error('User not found with email:', cleanEmail)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      emailVerified: user.emailVerified || new Date(),
    },
  })

  console.log(`Password updated successfully for ${user.email} (${user.id})!`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
