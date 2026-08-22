import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function createTranscriptionJob(data: { projectId: string; videoUrl: string }, prisma: PrismaClient) {
  const { projectId, videoUrl } = data

  // Update job status
  await prisma.processingJob.updateMany({
    where: { projectId, type: 'transcribe' },
    data: { status: 'processing', startedAt: new Date(), progress: 10 },
  })

  try {
    // Download video/audio (simplified - in production use signed URLs)
    // For now, we'll use OpenAI Whisper API directly with a public URL
    const transcription = await openai.audio.transcriptions.create({
      file: await fetchVideoAsFile(videoUrl),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    })

    // Store transcription with word-level timestamps
    await prisma.project.update({
      where: { id: projectId },
      data: {
        // We'll store this in a separate field or related model
      },
    })

    // Create clip generation job
    await prisma.processingJob.create({
      data: {
        projectId,
        type: 'clip_generation',
        status: 'queued',
      },
    })

    await prisma.processingJob.updateMany({
      where: { projectId, type: 'transcribe' },
      data: { status: 'completed', progress: 100, completedAt: new Date(), result: transcription },
    })

    return transcription
  } catch (error) {
    await prisma.processingJob.updateMany({
      where: { projectId, type: 'transcribe' },
      data: { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' },
    })
    throw error
  }
}

async function fetchVideoAsFile(url: string): Promise<File> {
  // In production, download from signed URL
  // For now, return a mock - actual implementation needs video download
  const response = await fetch(url)
  const blob = await response.blob()
  return new File([blob], 'video.mp4', { type: 'video/mp4' })
}