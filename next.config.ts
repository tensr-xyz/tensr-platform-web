import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'app.tensr.xyz',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
