import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2] || 'abbdelraheem@gmail.com'
  const password = process.argv[3] || 'Admin@Clipzila2026!'
  const name = 'Admin'

  const passwordHash = await bcrypt.hash(password, 12)

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  })

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: 'ADMIN',
        credits: 999999,
        emailVerified: existing.emailVerified || new Date(),
        passwordHash,
      },
    })
    console.log(`Updated admin user: ${updated.email} (${updated.id}) - role: ${updated.role}, credits: ${updated.credits}`)
  } else {
    const created = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        name,
        passwordHash,
        role: 'ADMIN',
        credits: 999999,
        emailVerified: new Date(),
      },
    })
    console.log(`Created admin user: ${created.email} (${created.id}) - role: ${created.role}, credits: ${created.credits}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
