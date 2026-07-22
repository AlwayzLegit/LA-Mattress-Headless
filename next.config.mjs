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

/**
 * Content-Security-Policy, derived from an inventory of every external
 * origin the client actually touches (session 2026-06-10 audit):
 *
 *   script-src    Next hydration + GA4 bootstrap + Judge.me preloader are
 *                 inline → 'unsafe-inline' is required (nonce-based CSP
 *                 needs per-request middleware rewrites — a follow-up).
 *                 External: gtag (googletagmanager), Judge.me widget
 *                 (cdnwidget.judge.me), PostHog lazy bundles — session
 *                 recorder etc. (us-assets.i.posthog.com), Vercel
 *                 analytics dev loader (va.vercel-scripts.com; prod
 *                 serves same-origin /_vercel/*). 'unsafe-eval' is
 *                 needed in ALL envs: dev for React Refresh, prod for
 *                 the Judge.me legacy widget (see inline note below).
 *   connect-src   PostHog ingest (us.i.posthog.com), GA4 collection
 *                 (*.google-analytics.com + doubleclick), Judge.me
 *                 review-widget API, Sentry (tunneled same-origin via
 *                 /monitoring, *.sentry.io kept for non-tunneled builds).
 *   img-src       https: stays broad ON PURPOSE — merchant HTML from
 *                 Shopify embeds arbitrary external <img> (see the
 *                 restonic.com hotlink cleanup, #426); pinning hosts
 *                 would break product/blog bodies on the next merchant
 *                 paste. Images can't execute script; exfiltration is
 *                 still bounded by the tight connect-src.
 *   frame-src     Google Maps embeds on showroom pages, Judge.me review
 *                 iframes, YouTube/Vimeo (merchant article embeds pass
 *                 sanitization by design — lib/sanitize.ts only strips
 *                 maps iframes).
 *   media-src     Shopify-hosted product video.
 *   worker-src    blob: — PostHog's session recorder spawns a worker.
 *   object-src    'none', base-uri 'self', form-action 'self',
 *                 frame-ancestors 'self' (belt+braces with XFO).
 */

// CSP violation telemetry (2026-06-11 incident follow-up). Both stages
// of the Judge.me widget breakage shipped silently: the CSP blocked the
// widget in every visitor's browser and nothing told us until a human
// browsed a PDP. Browsers POST a JSON report to `report-uri` for every
// violation of the enforced policy, and Sentry ingests those natively
// at its /security/ endpoint — so any future CSP-vs-third-party
// conflict surfaces as a Sentry issue within minutes of the deploy,
// from real traffic. The endpoint is derived from the DSN the app
// already uses; absent DSN (local dev without env) the directive is
// simply omitted. Expect some background noise from browser extensions
// injecting blocked resources — Sentry groups those into separate
// issues which can be ignored/muted; a flood of reports naming a real
// vendor host (judge.me, posthog, googletagmanager…) right after a
// deploy is the signal this exists for.
function sentryCspReportUri() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return '';
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, '');
    if (!u.username || !projectId) return '';
    return `https://${u.host}/api/${projectId}/security/?sentry_key=${u.username}`;
  } catch {
    return '';
  }
}
const CSP_REPORT_URI = sentryCspReportUri();

const CSP = [
  "default-src 'self'",
  // Judge.me note (2026-06-11 incident): the LEGACY review widget (this
  // shop was switched to it account-side by Judge.me support on
  // 2026-06-01, see judgeme-widget.tsx) loads its CONTENT via XHR from
  // cache.judge.me — NOT api.judge.me. The original origin inventory
  // missed it, so the day-one CSP blocked the fetch (status_code 0 +
  // "Cannot load Judge.me widget contents due to caching server error"
  // in PostHog replay console logs) and the PDP reviews widget rendered
  // empty. cdn.judge.me serves the widget's stylesheet, star icon font,
  // and secondary scripts. All additions below are Judge.me-owned
  // origins — same vendor trust boundary as the preloader.
  // 'unsafe-eval' is required IN PRODUCTION by the Judge.me legacy
  // widget: after fetching its cached contents it boots the widget
  // payload via eval() — with eval blocked the PDP reviews section
  // stays empty ("EvalError: Refused to evaluate a string as
  // JavaScript…" in PostHog replay console logs, 2026-06-11, observed
  // right after the cache.judge.me connect-src fix unblocked the
  // fetch). CSP cannot scope eval to a single origin, and script-src
  // already carries the strictly weaker 'unsafe-inline' (required by
  // the GA4 + Judge.me inline bootstraps), so this is a marginal
  // concession to keep a revenue-relevant widget alive. Revisit if
  // Judge.me ships an eval-free widget or the shop moves off the
  // legacy layout.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://cdnwidget.judge.me https://cdn.judge.me https://us-assets.i.posthog.com https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline' https://cdn.judge.me https://cdnwidget.judge.me",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://cdn.judge.me https://cdnwidget.judge.me",
  // Sentry CSP-violation telemetry (issues -2K/-26/-2J/-27/-2C, Jun 2026)
  // showed four wanted integrations being blocked in real browsers:
  // monorail-edge.shopifysvc.com (Shopify analytics beacon fired by the
  // Shop components in our own bundle — blocked for ~5.7k users),
  // tracking.aws.judge.me + cdnwidget.judge.me (Judge.me review widget
  // telemetry/prefetch), api.zippopotam.us (the locations-finder ZIP
  // geocoder — our own feature, silently broken by the block), and
  // www.google.com (GA4/GTM consent-mode pings).
  "connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com https://*.google-analytics.com https://www.googletagmanager.com https://www.google.com https://stats.g.doubleclick.net https://api.judge.me https://cache.judge.me https://cdn.judge.me https://cdnwidget.judge.me https://tracking.aws.judge.me https://monorail-edge.shopifysvc.com https://api.zippopotam.us https://*.sentry.io",
  "frame-src 'self' https://maps.google.com https://www.google.com https://judge.me https://*.judge.me https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "media-src 'self' blob: https://cdn.shopify.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(CSP_REPORT_URI ? [`report-uri ${CSP_REPORT_URI}`] : []),
].join('; ');

// Report-Only shadow policy (deep audit secpriv-02, phase 1 of the
// nonce-CSP track): identical to the enforced CSP except script-src
// drops 'unsafe-inline' + 'unsafe-eval'. Browsers report (never block)
// every script the stricter policy WOULD have blocked, giving us a
// production inventory of inline/eval scripts to nonce or eliminate —
// own JSON-LD blocks, the GA4/Judge.me bootstraps, and the Judge.me
// legacy eval — before the enforced policy can be tightened. Only
// emitted when CSP_REPORT_URI is configured: report-only without a
// report sink is dead weight on every response.
const CSP_REPORT_ONLY = CSP.replace(
  /script-src 'self' 'unsafe-inline' 'unsafe-eval'/,
  "script-src 'self'",
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Server Actions verify that the request Origin matches the
      // x-forwarded-host. Visitors who land on the apex domain (old
      // links, typed URLs) submit actions with Origin=apex while the
      // proxy forwards Host=www — Next aborted every such POST
      // ("Invalid Server Actions request", 38 affected users in the
      // Vercel runtime log through 2026-07-13). Cart mutations are
      // Server Actions, so this was silently breaking add-to-cart for
      // apex visitors. Allow both hosts; middleware still 308s apex
      // GETs to www.
      allowedOrigins: [
        'www.mattressstoreslosangeles.com',
        'mattressstoreslosangeles.com',
      ],
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          ...(CSP_REPORT_URI
            ? [{ key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY }]
            : []),
          // Storefront pages are never legitimately iframed by other
          // origins. SAMEORIGIN (not DENY) so any future own-origin
          // embedding keeps working.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Browsers must honor declared MIME types — blocks content-
          // sniffing a response into an executable type.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Send full referrer same-origin only; cross-origin gets just
          // the origin. Keeps internal analytics intact without leaking
          // URL paths (incl. search queries) to third parties.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // geolocation=(self): the store locator's "Use My Location"
          // button (locations-finder.tsx) needs it on our origin.
          // Camera/mic are unused anywhere — fully denied.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },
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
