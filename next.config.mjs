import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { withSentryConfig } from '@sentry/nextjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Next.js's `redirects()` validator requires every `source` to:
 *
 *   - start with `/`
 *   - NOT contain `?` / `#` in the path (query matching needs `has`)
 *   - NOT contain `path-to-regexp` meta-characters unless intended as
 *     a route pattern: `:` (named param), `*` (wildcard), `+` (one-or-more),
 *     `(` `)` (groups), `[` `]` / `{` `}` (escape constructs)
 *
 * Shopify's urlRedirects table includes legacy entries that violate all
 * of these (250+ with `?_pos=`/`?variant=`, plus paths like
 * `/https:/...` and `/tel:1-800-...` whose embedded `:` makes Next's
 * path-to-regexp parser raise "Missing parameter name at N" and crash
 * the entire build — that's the post-PR-#273 build break + the
 * post-#276 build re-break).
 *
 * Filter both shape (source/destination strings present) AND Next.js's
 * source-format rules. The dropped entries are noisy URL-encoded /
 * protocol-prefixed redirects that the middleware's param-stripping
 * (middleware.ts + lib/route-canonicalization.ts) already handles via
 * 301 — no functional regression from skipping them at the edge.
 */
const PATH_TO_REGEXP_META = /[:*+()\[\]{}]/;
const NEXT_REDIRECT_SOURCE_VALID = (s) =>
  typeof s === 'string'
  && s.startsWith('/')
  && !s.includes('?')
  && !s.includes('#')
  && !PATH_TO_REGEXP_META.test(s);

function loadInventoryRedirects() {
  try {
    const raw = readFileSync(resolve(__dirname, 'data/url-inventory/redirects.json'), 'utf8');
    const json = JSON.parse(raw);
    if (!Array.isArray(json.redirects)) return [];
    let dropped = 0;
    const valid = json.redirects
      .filter((r) => {
        if (!r || typeof r.source !== 'string' || typeof r.destination !== 'string') {
          dropped += 1;
          return false;
        }
        if (!NEXT_REDIRECT_SOURCE_VALID(r.source)) {
          dropped += 1;
          return false;
        }
        return true;
      })
      .map((r) => ({
        source: r.source,
        destination: r.destination,
        permanent: r.permanent !== false,
      }));
    if (dropped > 0) {
      console.warn(`[next.config] Skipped ${dropped} malformed redirect(s) — source must start with "/" and not contain "?" or "#".`);
    }
    return valid;
  } catch (err) {
    console.warn('[next.config] Could not load redirects.json:', err.message);
    return [];
  }
}

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
  async redirects() {
    return loadInventoryRedirects();
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
