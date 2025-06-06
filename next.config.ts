import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
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
