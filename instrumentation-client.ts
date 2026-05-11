// Sentry client-side init. Moved from sentry.client.config.ts in Phase 185
// to follow the @sentry/nextjs guidance (and the Turbopack requirement —
// sentry.client.config.ts will stop being picked up under Turbopack).
//
// The server / edge configs stay at sentry.server.config.ts and
// sentry.edge.config.ts, loaded via the existing register() hook in
// instrumentation.ts. Only the client config needed to relocate.

import * as Sentry from '@sentry/nextjs';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// No-op when DSN isn't set so dev/staging without a Sentry project just
// runs without telemetry. Set NEXT_PUBLIC_SENTRY_DSN in Vercel env vars
// (all 3 environments) to turn it on.
//
// Phase 166: Replay integration intentionally NOT included. Adds ~50KB
// to every page's First Load JS. Error capture via Sentry.captureException
// (in error.tsx + global-error.tsx) gives us the stack traces and
// breadcrumbs we need for triage; replay sessions are nice-to-have but
// not worth the bundle cost on a perf-sensitive commerce site.
if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.1,
    debug: false,
  });
}
