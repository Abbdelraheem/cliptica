import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Jost } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const cormorant = Cormorant_Garamond({
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
})

const jost = Jost({
  variable: '--font-body',
  weight: ['300', '400', '500', '600'],
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Cliptica — AI Video Clipping Platform',
    template: '%s | Cliptica',
  },
  description: 'AI video clipping: turn one long video into short, ready-to-post clips. Paste a link, get finished clips with captions, motion graphics, and auto-reframe.',
  keywords: ['video clipping', 'AI video editing', 'short form video', 'content repurposing', 'viral clips'],
  authors: [{ name: 'Cliptica' }],
  creator: 'Cliptica',
  publisher: 'Cliptica',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://cliptica.com',
    siteName: 'Cliptica',
    title: 'Cliptica — AI Video Clipping Platform',
    description: 'AI video clipping: turn one long video into short, ready-to-post clips.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Cliptica Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cliptica — AI Video Clipping Platform',
    description: 'AI video clipping: turn one long video into short, ready-to-post clips.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#070608',
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
    <html lang="en" className={`${cormorant.variable} ${jost.variable} h-full antialiased`}>
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