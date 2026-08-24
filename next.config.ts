import type { NextConfig } from 'next'
import path from 'path'

// STATIC_EXPORT=1 → build a static site for GitHub Pages
const isStaticExport = process.env.STATIC_EXPORT === '1'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  ...(isStaticExport
    ? {
        output: 'export' as const,
        trailingSlash: true,
        basePath: '/cliptica',
        assetPrefix: '/cliptica/',
        images: { unoptimized: true },
      }
    : {}),
  ...(!isStaticExport && {
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: '**',
        },
      ],
      formats: ['image/avif', 'image/webp'],
    },
  }),
  experimental: {
    serverActions: {
      bodySizeLimit: '2gb',
    },
  },
  async headers() {
    // No wildcard: credentials + '*' is an invalid (unsafe) combination.
    // When NEXT_PUBLIC_APP_URL is unset we emit no ACAO header at all,
    // which keeps same-origin calls working and blocks cross-origin reads.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    const corsHeaders: { key: string; value: string }[] = [
      { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
      { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
    ]
    if (appUrl) {
      corsHeaders.unshift(
        { key: 'Access-Control-Allow-Credentials', value: 'true' },
        { key: 'Vary', value: 'Origin' },
      )
      corsHeaders.push({ key: 'Access-Control-Allow-Origin', value: appUrl })
    }
    return [
      {
        source: '/api/:path*',
        headers: corsHeaders,
      },
    ]
  },
}

export default nextConfig
