import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface ClipCandidate {
  start: number
  end: number
  title: string
  description: string
  viralScore: number
  hookScore: number
  retentionScore: number
  shareScore: number
  reasoning: string
}

export async function createAnalysisJob(data: { projectId: string; transcription: any; instructions?: string }, prisma: PrismaClient) {
  const { projectId, transcription, instructions } = data

  await prisma.processingJob.updateMany({
    where: { projectId, type: 'analysis' },
    data: { status: 'processing', startedAt: new Date(), progress: 10 },
  })

  try {
    // Use GPT-4 to analyze transcription and find viral moments
    const prompt = buildAnalysisPrompt(transcription, instructions)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    const clips: ClipCandidate[] = result.clips || []

    // Filter and score clips
    const scoredClips = clips
      .filter(c => c.viralScore >= 60) // Quality threshold
      .sort((a, b) => b.viralScore - a.viralScore)
      .slice(0, 10) // Top 10 clips

    // Store clips in database
    for (const clip of scoredClips) {
      await prisma.clip.create({
        data: {
          projectId,
          userId: (await prisma.project.findUnique({ where: { id: projectId } }))!.userId,
          title: clip.title,
          description: clip.description,
          sourceStart: Math.round(clip.start),
          sourceEnd: Math.round(clip.end),
          duration: Math.round(clip.end - clip.start),
          viralScore: clip.viralScore,
          hookScore: clip.hookScore,
          retentionScore: clip.retentionScore,
          shareScore: clip.shareScore,
          status: 'READY',
        },
      })
    }

    // Create render jobs for each clip
    for (const clip of scoredClips) {
      await prisma.processingJob.create({
        data: {
          projectId,
          type: 'render',
          status: 'queued',
          result: { clipData: clip },
        },
      })
    }

    await prisma.processingJob.updateMany({
      where: { projectId, type: 'analysis' },
      data: { status: 'completed', progress: 100, completedAt: new Date(), result: { clips: scoredClips } },
    })

    return { clips: scoredClips }
  } catch (error) {
    await prisma.processingJob.updateMany({
      where: { projectId, type: 'analysis' },
      data: { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' },
    })
    throw error
  }
}

const SYSTEM_PROMPT = `You are an expert short-form video editor. Analyze the transcript and identify the most viral-worthy clips.

Scoring criteria:
- Hook Strength (0-100): How compelling is the opening 3 seconds?
- Story Arc (0-100): Does it have a clear beginning, middle, payoff?
- Retention Potential (0-100): Will viewers watch to the end?
- Shareability (0-100): Is it relatable, controversial, or valuable enough to share?

Only return clips that score 60+ overall. Each clip must be a complete thought (start/end on sentence boundaries).`

function buildAnalysisPrompt(transcription: any, instructions?: string): string {
  const segments = transcription.segments || []
  const fullText = segments.map((s: any) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`).join('\n')

  return `Transcript with timestamps:
${fullText}

${instructions ? `User Instructions: ${instructions}` : ''}

Return JSON with clips array:
{
  "clips": [
    {
      "start": 12.5,
      "end": 45.2,
      "title": "Clip title",
      "description": "Why this clip works",
      "viralScore": 92,
      "hookScore": 95,
      "retentionScore": 88,
      "shareScore": 90,
      "reasoning": "Opens with strong hook, clear payoff..."
    }
  ]
}`