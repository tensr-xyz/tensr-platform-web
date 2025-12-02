import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',

  // Enable React Compiler for automatic memoization (Next.js 16)
  // This automatically optimizes components and reduces unnecessary re-renders
  reactCompiler: true,

  // Enable Cache Components for better caching (Next.js 16)
  // This provides fine-grained control over caching with "use cache" directive
  cacheComponents: true,

  // Enable Turbopack filesystem caching for faster dev startup (Next.js 16)
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'app.tensr.xyz',
        pathname: '/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    unoptimized: process.env.NODE_ENV === 'development',
    domains: ['localhost'],
  },

  // Compression and optimization
  compress: true,
  poweredByHeader: false,

  // Headers for caching and security
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=600',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
