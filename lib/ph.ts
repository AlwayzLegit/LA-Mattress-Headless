'use client';

/**
 * Lazy posthog-js loader (audit perf-js-03).
 *
 * posthog-js is ~63KB gzip — the single largest identifiable
 * third-party chunk in First Load JS. It was statically imported by
 * lib/analytics.ts, analytics-posthog.tsx, and analytics-ga4.tsx (the
 * comment claiming it was "lazy-imported" was stale), which welded it
 * into the shared client bundle of every route.
 *
 * This module is the only place allowed to import posthog-js, and it
 * does so with a dynamic import() so the SDK lands in its own async
 * chunk fetched after hydration. Every call site goes through
 * `withPostHog(fn)`: before the SDK arrives, callbacks queue; once
 * `loadPostHog()` resolves (kicked off by AnalyticsPostHog on mount),
 * the queue drains in order and later calls run synchronously. Events
 * fired during the load window are therefore delayed a few hundred ms,
 * never lost.
 *
 * Environments without NEXT_PUBLIC_POSTHOG_KEY never call loadPostHog,
 * so the queue just absorbs no-op callbacks — same net behavior as the
 * old `posthog.capture` no-op on an uninitialized SDK.
 */

type PostHog = typeof import('posthog-js').default;

let instance: PostHog | null = null;
let loading: Promise<PostHog> | null = null;
let queue: Array<(ph: PostHog) => void> = [];

/** Run `fn` with the PostHog SDK — immediately if loaded, else queued. */
export function withPostHog(fn: (ph: PostHog) => void): void {
  if (instance) {
    fn(instance);
    return;
  }
  queue.push(fn);
}

/** Import the SDK (once) and drain the pending-call queue. */
export function loadPostHog(): Promise<PostHog> {
  if (loading) return loading;
  loading = import('posthog-js').then((mod) => {
    instance = mod.default;
    const pending = queue;
    queue = [];
    for (const fn of pending) fn(instance);
    return instance;
  });
  return loading;
}
