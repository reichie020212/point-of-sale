/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['@counter/tokens'],
  },
  transpilePackages: ['@counter/tokens'],
  // Marketing route group serves counter.app; dashboard serves
  // app.counter.app. Both run from the same Next.js process — host-based
  // routing is handled at the edge in production (Vercel).
  async rewrites() {
    return [];
  },
};

export default nextConfig;
