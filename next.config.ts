import type { NextConfig } from 'next'
import path from 'path'

// STATIC_EXPORT=1 → build a static site for GitHub Pages
const isStaticExport = process.env.STATIC_EXPORT === '1'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  eslint: {
    ignoreDuringBuilds: true,
  },
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
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ]
  },
}

export default nextConfig
