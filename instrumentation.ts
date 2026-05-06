/**
 * Next.js instrumentation hook — runs once at server startup. Loads the
 * appropriate Sentry config for the current runtime (Node or edge).
 *
 * Stays a no-op when SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN aren't set, so
 * the app boots fine in environments that don't have Sentry configured.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs';
