import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // ppr: true, // Temporarily disabled to debug build issue
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
      {
        hostname: 'cdn.ct-static.com',
        protocol: 'https',
      },
      {
        hostname: 'static.cellartracker.com',
        protocol: 'https',
      },
      {
        hostname: 'www.cellartracker.com',
        protocol: 'https',
      },
    ],
  },
};

export default nextConfig;
