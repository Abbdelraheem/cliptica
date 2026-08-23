import type { Metadata, Viewport } from 'next'
import { Manrope, Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const manrope = Manrope({
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
  subsets: ['latin'],
})

const inter = Inter({
  variable: '--font-body',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'NOLOGY — One video in. A week of clips out.',
    template: '%s | NOLOGY',
  },
  description:
    'Paste a YouTube link and get ready-to-post vertical clips. AI finds the viral moments, crops with face-tracking, burns word-perfect captions, and scores every clip.',
  keywords: ['ai clipping', 'video to shorts', 'youtube clips', 'viral moments', 'auto captions', '9:16 crop', 'short form video'],
  authors: [{ name: 'NOLOGY' }],
  creator: 'NOLOGY',
  publisher: 'NOLOGY',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://getnology.com',
    siteName: 'NOLOGY',
    title: 'NOLOGY — One video in. A week of clips out.',
    description: 'AI that finds the viral moments in your videos and turns them into ready-to-post shorts.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NOLOGY — One video in. A week of clips out.',
    description: 'AI clipping engine for creators.',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#050505',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="grain min-h-full bg-onyx text-pearl antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
