import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()
const targetFile = process.argv[2] || '/tmp/db_backup.json'

async function exportAll() {
  try {
    const [users, projects, clips, jobs, campaigns, payouts, creditTransactions, apiKeys] = await Promise.all([
      prisma.user.findMany(),
      prisma.project.findMany(),
      prisma.clip.findMany(),
      prisma.processingJob.findMany(),
      prisma.campaign.findMany(),
      prisma.payout.findMany(),
      prisma.creditTransaction.findMany(),
      prisma.apiKey.findMany(),
    ])

    const dump = {
      exportedAt: new Date().toISOString(),
      counts: {
        users: users.length,
        projects: projects.length,
        clips: clips.length,
        jobs: jobs.length,
        campaigns: campaigns.length,
        payouts: payouts.length,
        creditTransactions: creditTransactions.length,
        apiKeys: apiKeys.length,
      },
      data: {
        users,
        projects,
        clips,
        jobs,
        campaigns,
        payouts,
        creditTransactions,
        apiKeys,
      },
    }

    fs.writeFileSync(targetFile, JSON.stringify(dump, null, 2), 'utf-8')
    console.log(Exported database cleanly to \)
  } catch (err) {
    console.error('Failed to export database:', err)
    process.exit(1)
  } finally {
    await prisma.()
  }
}

exportAll()
