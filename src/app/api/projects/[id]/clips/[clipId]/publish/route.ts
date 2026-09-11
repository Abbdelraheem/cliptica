import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { publishClipToSocial } from '@/lib/social/tokens'
import { SocialPlatformType } from '@/lib/social/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized', message: 'Please sign in to publish clips.' }, { status: 401 })
  }

  const { clipId } = await params
  let body: {
    platform?: string
    title?: string
    description?: string
    privacy?: string
    tags?: string[]
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json', message: 'Invalid JSON request payload.' }, { status: 400 })
  }

  const rawPlatform = body.platform?.toUpperCase() as SocialPlatformType
  if (!rawPlatform || !['TIKTOK', 'YOUTUBE', 'INSTAGRAM'].includes(rawPlatform)) {
    return NextResponse.json(
      {
        error: 'invalid_platform',
        message: 'Platform must be one of TIKTOK, YOUTUBE, or INSTAGRAM.',
      },
      { status: 400 }
    )
  }

  const result = await publishClipToSocial(session.user.id, clipId, rawPlatform, {
    title: body.title,
    description: body.description,
    privacy: body.privacy,
    tags: body.tags,
  })

  if (!result.success) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json(result, { status: 200 })
}
