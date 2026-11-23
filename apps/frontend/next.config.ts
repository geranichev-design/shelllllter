import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  transpilePackages: ['@repo/ui']
};

export default nextConfig;
