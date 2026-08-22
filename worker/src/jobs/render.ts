import { PrismaClient } from '@prisma/client'
import ffmpeg from 'fluent-ffmpeg'
import { promises as fs } from 'fs'
import path from 'path'

export async function createRenderJob(data: { projectId: string; clipData: any }, prisma: PrismaClient) {
  const { projectId, clipData } = data

  const job = await prisma.processingJob.findFirst({
    where: { projectId, type: 'render', status: 'queued' },
    orderBy: { createdAt: 'asc' },
  })

  if (!job) return

  await prisma.processingJob.update({
    where: { id: job.id },
    data: { status: 'processing', startedAt: new Date(), progress: 5 },
  })

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project || !project.sourceFile && !project.sourceUrl) {
      throw new Error('No source video found')
    }

    // In production, download source video from signed URL
    const sourcePath = await downloadSourceVideo(project)
    const outputDir = path.join(process.env.OUTPUT_DIR || '/tmp/cliptica', projectId)
    await fs.mkdir(outputDir, { recursive: true })

    const outputPath = path.join(outputDir, `clip_${clipData.start}_${clipData.end}.mp4`)

    // Render with FFmpeg
    await renderClip(sourcePath, outputPath, clipData)

    // Upload to storage (S3/R2) and get public URL
    const videoUrl = await uploadToStorage(outputPath, `projects/${projectId}/clip_${clipData.start}_${clipData.end}.mp4`)

    // Generate thumbnail
    const thumbPath = path.join(outputDir, `thumb_${clipData.start}_${clipData.end}.jpg`)
    await generateThumbnail(sourcePath, thumbPath, clipData.start)
    const thumbnailUrl = await uploadToStorage(thumbPath, `projects/${projectId}/thumb_${clipData.start}_${clipData.end}.jpg`)

    // Update clip record
    await prisma.clip.updateMany({
      where: { projectId, sourceStart: clipData.start, sourceEnd: clipData.end },
      data: {
        videoUrl,
        thumbnailUrl,
        status: 'READY',
      },
    })

    await prisma.processingJob.update({
      where: { id: job.id },
      data: { status: 'completed', progress: 100, completedAt: new Date(), result: { videoUrl, thumbnailUrl } },
    })

    // Update project status if all clips done
    const pendingRenders = await prisma.processingJob.count({
      where: { projectId, type: 'render', status: { in: ['queued', 'processing'] } },
    })

    if (pendingRenders === 0) {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: 'COMPLETED' },
      })
    }

    return { videoUrl, thumbnailUrl }
  } catch (error) {
    await prisma.processingJob.update({
      where: { id: job.id },
      data: { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' },
    })
    throw error
  }
}

async function downloadSourceVideo(project: any): Promise<string> {
  // Implementation depends on storage provider
  // For now, return a placeholder
  return '/tmp/source_video.mp4'
}

async function renderClip(sourcePath: string, outputPath: string, clipData: any): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(sourcePath)
      .setStartTime(clipData.start)
      .setDuration(clipData.end - clipData.start)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black',
        '-preset', 'medium',
        '-crf', '23',
        '-movflags', '+faststart',
      ])
      .on('progress', (progress) => {
        // Update job progress
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath)
  })
}

async function generateThumbnail(sourcePath: string, outputPath: string, timestamp: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(sourcePath)
      .setStartTime(timestamp)
      .frames(1)
      .size('1080x1920')
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath)
  })
}

async function uploadToStorage(localPath: string, remotePath: string): Promise<string> {
  // Implement S3/R2/UploadThing upload
  // Return public URL
  return `https://storage.example.com/${remotePath}`
}