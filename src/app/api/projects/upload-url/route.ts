import { NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth'
import { r2PresignPut } from '@/lib/r2'
import { getSettingNumber } from '@/lib/settings'

const ALLOWED = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm']
const EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  'video/webm': 'webm',
}

const bodySchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string(),
  sizeMb: z.number().positive(),
})

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const maxMb = await getSettingNumber('max_upload_mb', process.env.MAX_UPLOAD_MB, 500)

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success || !ALLOWED.includes(parsed.data.contentType)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }
    if (parsed.data.sizeMb > maxMb) {
      return NextResponse.json({ error: `File exceeds ${maxMb}MB limit` }, { status: 413 })
    }

    const ext = EXT[parsed.data.contentType]
    const key = `uploads/${session.user.id}/${randomUUID()}.${ext}`
    const uploadUrl = r2PresignPut(key, parsed.data.contentType)

    return NextResponse.json({ uploadUrl, key, maxMb })
  } catch (error) {
    console.error('upload-url error:', error)
    return NextResponse.json({ error: 'Could not create upload URL' }, { status: 500 })
  }
}
