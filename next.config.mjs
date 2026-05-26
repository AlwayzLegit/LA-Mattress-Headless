import { withSentryConfig } from '@sentry/nextjs';

/**
 * Legacy Shopify urlRedirects are NOT declared here.
 *
 * They live in `data/url-inventory/redirects.json` (Shopify Admin export),
 * are codegen'd by `scripts/build-redirects-table.mjs` into
 * `lib/redirects-table.ts`, and served at the edge by `middleware.ts`.
 *
 * Why not `next.config.mjs#redirects()`:
 *   - Vercel hard-caps that hook at 1024 entries per deployment.
 *     Our table is 2000+ entries.
 *   - Middleware has no such cap and runs in the same edge layer, so
 *     there's no perf regression — actually faster (O(1) Map lookup vs.
 *     Next's compiled path-to-regexp chain).
 *
 * See middleware.ts for the lookup logic and scripts/build-redirects-table.mjs
 * for the codegen step (wired into `prebuild` in package.json).
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Route every <Image> through lib/image-loader.ts. Avoids Vercel's
    // /_next/image optimizer (per-account quota → 402 Payment Required
    // breaks every product photo when exhausted) and uses Shopify's
    // built-in CDN transforms instead — already paid for + edge-cached.
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: 'mattressstoreslosangeles.com' },
    ],
  },
};

// withSentryConfig wraps the Next config to handle:
//   - Source map upload during build (so prod stack traces show
//     original-source filenames + line numbers, not minified output).
//   - Tunnel route to bypass ad blockers blocking sentry.io directly.
//   - Auto-instrumentation of API routes for trace context.
//
// All Sentry build features are gated on SENTRY_AUTH_TOKEN being set in
// the build env (Vercel env vars). Without it, the wrapper is effectively
// a no-op for the build but the runtime SDK still captures errors.
export default withSentryConfig(nextConfig, {
  // Org + project come from .sentryclirc or env. Sentry CLI auto-detects.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Suppress source map upload logs in prod build output.
  silent: !process.env.CI,
  // Tunnel /monitoring requests through our domain to bypass ad blockers.
  tunnelRoute: '/monitoring',
  // Hide source maps from prod public access (only Sentry can read them).
  hideSourceMaps: true,
});
