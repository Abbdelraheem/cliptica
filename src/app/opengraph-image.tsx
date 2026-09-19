import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Clipzila — One video in. A week of clips out.'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#070709',
          backgroundImage:
            'radial-gradient(circle at 50% 35%, rgba(255, 90, 31, 0.18) 0%, rgba(7, 7, 9, 0) 70%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          padding: '48px',
          position: 'relative',
        }}
      >
        {/* Brand badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '28px',
            padding: '10px 24px',
            borderRadius: '999px',
            border: '1px solid rgba(255, 90, 31, 0.35)',
            backgroundColor: 'rgba(255, 90, 31, 0.08)',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #FF7A3D 0%, #E8430A 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '0',
                height: '0',
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderLeft: '8px solid #ffffff',
                marginLeft: '2px',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: '#ffffff',
            }}
          >
            CLIPZILA
          </span>
        </div>

        {/* Main Headline */}
        <h1
          style={{
            fontSize: '64px',
            fontWeight: 800,
            textAlign: 'center',
            lineHeight: 1.15,
            maxWidth: '900px',
            margin: '0 0 20px 0',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #E0DCD3 100%)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          One video in. A week of viral clips out.
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: '26px',
            color: '#A09C92',
            textAlign: 'center',
            maxWidth: '780px',
            margin: '0 0 36px 0',
            lineHeight: 1.4,
          }}
        >
          AI moment hunting · 9:16 Face-tracking · Word-perfect karaoke subtitles · Instant export
        </p>

        {/* Bottom pill features */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            fontSize: '16px',
            color: '#E8A370',
          }}
        >
          <span>• Groq Whisper Transcription</span>
          <span>• LLaMA 3.3 Viral Scoring</span>
          <span>• Multi-Platform Publishing</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
