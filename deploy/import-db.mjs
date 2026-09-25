import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()
const sourceFile = process.argv[2] || '/opt/nology-backups/nology-backup-20260909-214800/database.json'

async function importAll() {
  if (!fs.existsSync(sourceFile)) {
    console.error('Source file not found:', sourceFile)
    process.exit(1)
  }

  const { data } = JSON.parse(fs.readFileSync(sourceFile, 'utf8'))
  if (!data) {
    console.error('No data found in json')
    process.exit(1)
  }

  console.log('Importing data from:', sourceFile)

  // Map old user IDs to database user IDs
  const userIdMap = new Map()

  // 1. Users
  if (data.users && data.users.length > 0) {
    console.log(`Importing ${data.users.length} users...`)
    for (const u of data.users) {
      const cleanEmail = u.email.trim().toLowerCase()
      const existing = await prisma.user.findFirst({
        where: { email: { equals: cleanEmail, mode: 'insensitive' } },
      })

      if (existing) {
        userIdMap.set(u.id, existing.id)
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: u.name || existing.name,
            passwordHash: u.passwordHash || existing.passwordHash,
            role: u.role === 'ADMIN' ? 'ADMIN' : existing.role,
            credits: existing.role === 'ADMIN' || u.role === 'ADMIN' ? 999999 : (u.credits ?? existing.credits),
            emailVerified: existing.emailVerified || (u.emailVerified ? new Date(u.emailVerified) : new Date()),
          },
        })
        console.log(`Updated user ${cleanEmail} -> mapped ${u.id} to ${existing.id}`)
      } else {
        const created = await prisma.user.create({
          data: {
            id: u.id,
            email: cleanEmail,
            name: u.name,
            passwordHash: u.passwordHash,
            role: u.role,
            credits: u.credits ?? 50,
            emailVerified: u.emailVerified ? new Date(u.emailVerified) : new Date(),
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          },
        })
        userIdMap.set(u.id, created.id)
        console.log(`Created user ${cleanEmail} (${created.id})`)
      }
    }
  }

  // 2. Projects
  if (data.projects && data.projects.length > 0) {
    console.log(`Importing ${data.projects.length} projects...`)
    for (const p of data.projects) {
      const { clips: _, jobs: __, motionFx: ___, ...projData } = p
      const mappedUserId = userIdMap.get(p.userId) || p.userId
      
      const existsUser = await prisma.user.findUnique({ where: { id: mappedUserId } })
      if (!existsUser) {
        console.warn(`Skipping project ${p.id}: user ${mappedUserId} not found`)
        continue
      }

      await prisma.project.upsert({
        where: { id: p.id },
        update: {
          ...projData,
          userId: mappedUserId,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        },
        create: {
          ...projData,
          userId: mappedUserId,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        },
      }).catch(err => console.warn(`Project ${p.id} error:`, err.message))
    }
  }

  // 3. Clips
  if (data.clips && data.clips.length > 0) {
    console.log(`Importing ${data.clips.length} clips...`)
    for (const cl of data.clips) {
      const projExists = await prisma.project.findUnique({ where: { id: cl.projectId } })
      if (!projExists) continue

      await prisma.clip.upsert({
        where: { id: cl.id },
        update: {
          ...cl,
          createdAt: cl.createdAt ? new Date(cl.createdAt) : new Date(),
        },
        create: {
          ...cl,
          createdAt: cl.createdAt ? new Date(cl.createdAt) : new Date(),
        },
      }).catch(err => console.warn(`Clip ${cl.id} error:`, err.message))
    }
  }

  // 4. Jobs
  if (data.jobs && data.jobs.length > 0) {
    console.log(`Importing ${data.jobs.length} processing jobs...`)
    for (const j of data.jobs) {
      const projExists = await prisma.project.findUnique({ where: { id: j.projectId } })
      if (!projExists) continue

      await prisma.processingJob.upsert({
        where: { id: j.id },
        update: {
          ...j,
          createdAt: j.createdAt ? new Date(j.createdAt) : new Date(),
          updatedAt: j.updatedAt ? new Date(j.updatedAt) : new Date(),
        },
        create: {
          ...j,
          createdAt: j.createdAt ? new Date(j.createdAt) : new Date(),
          updatedAt: j.updatedAt ? new Date(j.updatedAt) : new Date(),
        },
      }).catch(err => console.warn(`Job ${j.id} error:`, err.message))
    }
  }

  // 5. Credit Transactions
  if (data.creditTransactions && data.creditTransactions.length > 0) {
    console.log(`Importing ${data.creditTransactions.length} credit transactions...`)
    for (const ct of data.creditTransactions) {
      const mappedUserId = userIdMap.get(ct.userId) || ct.userId
      const userExists = await prisma.user.findUnique({ where: { id: mappedUserId } })
      if (!userExists) continue

      await prisma.creditTransaction.upsert({
        where: { id: ct.id },
        update: {
          ...ct,
          userId: mappedUserId,
          createdAt: ct.createdAt ? new Date(ct.createdAt) : new Date(),
        },
        create: {
          ...ct,
          userId: mappedUserId,
          createdAt: ct.createdAt ? new Date(ct.createdAt) : new Date(),
        },
      }).catch(err => console.warn(`Transaction ${ct.id} error:`, err.message))
    }
  }

  console.log('--- RESTORE FINISHED SUCCESSFULLY ---')
}

importAll()
  .catch(e => {
    console.error('Import failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
