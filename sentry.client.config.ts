import * as Sentry from '@sentry/nextjs';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// No-op when DSN isn't set so dev/staging without a Sentry project just
// runs without telemetry. Set NEXT_PUBLIC_SENTRY_DSN in Vercel env vars
// (all 3 environments) to turn it on.
if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    debug: false,
    integrations: [Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false })],
  });
}
