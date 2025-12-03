import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignore TypeScript errors during build to prevent PPR conflicts
    ignoreBuildErrors: true,
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
