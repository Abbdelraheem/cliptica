import type { NextConfig } from 'next'
import path from 'path'

// STATIC_EXPORT=1 → build a static site for GitHub Pages
const isStaticExport = process.env.STATIC_EXPORT === '1'

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
      { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
      { key: 'Access-Control-Max-Age', value: '86400' },
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
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
      {
        source: '/(images|brand|marketing)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/api/:path*',
        headers: corsHeaders,
      },
    ]
  },
}

export default nextConfig
