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
    default: 'ClipForge — Turn Content Into Reach. Turn Reach Into Revenue.',
    template: '%s | ClipForge',
  },
  description:
    'Clip. Publish. Track. Earn. The all-in-one platform for creators, editors and brands building the next generation of short-form content.',
  keywords: ['clipping marketplace', 'creator economy', 'short form video', 'campaign rewards', 'clip editing', 'leaderboard'],
  authors: [{ name: 'ClipForge' }],
  creator: 'ClipForge',
  publisher: 'ClipForge',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://clipforge.app',
    siteName: 'ClipForge',
    title: 'ClipForge — Turn Content Into Reach. Turn Reach Into Revenue.',
    description: 'The all-in-one platform for creators, editors and brands building the next generation of short-form content.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClipForge — Turn Content Into Reach.',
    description: 'Clip. Publish. Track. Earn.',
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
