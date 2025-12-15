import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: ['@number-flow/react', 'number-flow'],
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    // We disable this during build because of pre-existing linting issues
    // TODO: Fix linting issues in the codebase
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Enable build even with TypeScript errors (for pre-existing issues)
    // TODO: Fix TypeScript errors in the codebase
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    // Handle ace-builds webpack-specific imports
    config.resolve.alias = {
      ...config.resolve.alias,
      'file-loader': false,
    }
    
    return config
  },
}

export default nextConfig

