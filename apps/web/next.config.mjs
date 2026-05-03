import { withSentryConfig } from '@sentry/nextjs';

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

// `withSentryConfig` wraps the build with Sentry's webpack plugin.
// When SENTRY_AUTH_TOKEN + project slugs are set, it uploads source
// maps and tags releases with the git sha. When unset, it's a near
// no-op — the runtime SDKs still work via env-driven init in
// sentry.client/server/edge.config.ts.
const sentryOptions = {
  silent: !process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: { name: process.env.SENTRY_RELEASE },
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  disableLogger: true,
};

export default withSentryConfig(nextConfig, sentryOptions);
