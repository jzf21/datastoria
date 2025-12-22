import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: ['@number-flow/react', 'number-flow'],
  typescript: {
    // Enable build even with TypeScript errors (for pre-existing issues)
    // TODO: Fix TypeScript errors in the codebase
    ignoreBuildErrors: true,
  },
  // Enable standalone output for Docker deployment
  output: 'standalone',
}

export default nextConfig

