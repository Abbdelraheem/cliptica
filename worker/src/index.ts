import { Queue, Worker } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { createTranscriptionJob } from './jobs/transcribe'
import { createAnalysisJob } from './jobs/analyze'
import { createRenderJob } from './jobs/render'
import { redisConnection } from './utils/redis'

const prisma = new PrismaClient()

// Job queues
export const transcriptionQueue = new Queue('transcription', { connection: redisConnection })
export const analysisQueue = new Queue('analysis', { connection: redisConnection })
export const renderQueue = new Queue('render', { connection: redisConnection })

// Workers
const transcriptionWorker = new Worker('transcription', async (job) => {
  await createTranscriptionJob(job.data, prisma)
}, { connection: redisConnection })

const analysisWorker = new Worker('analysis', async (job) => {
  await createAnalysisJob(job.data, prisma)
}, { connection: redisConnection })

const renderWorker = new Worker('render', async (job) => {
  await createRenderJob(job.data, prisma)
}, { connection: redisConnection })

// Error handling
;[transcriptionWorker, analysisWorker, renderWorker].forEach(worker => {
  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err)
  })
  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`)
  })
})

console.log('Cliptica workers started')

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...')
  await Promise.all([
    transcriptionWorker.close(),
    analysisWorker.close(),
    renderWorker.close(),
  ])
  await prisma.$disconnect()
  process.exit(0)
})