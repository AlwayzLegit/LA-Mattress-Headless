'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { loadPostHog, withPostHog } from '@/lib/ph';
import { registerAttribution } from '@/lib/analytics';

/**
 * PostHog client-side analytics provider.
 *
 * Gated on NEXT_PUBLIC_POSTHOG_KEY so dev/staging without a PostHog
 * project just renders nothing — matches the GA4 / Sentry no-op pattern
 * elsewhere in the codebase. Set NEXT_PUBLIC_POSTHOG_KEY + (optional)
 * NEXT_PUBLIC_POSTHOG_HOST in Vercel env vars (all 3 environments) to
 * turn it on.
 *
 * What this covers (the observability gap GA4 doesn't fill):
 *   - User-journey funnel events (PLP view → PDP view → add_to_cart →
 *     checkout_started → order_completed). Fire via track() in
 *     lib/analytics.ts. Powers funnel charts in PostHog Insights.
 *   - Session replay sampled at 10% of sessions (see REPLAY_SAMPLE_RATE).
 *   - Auto-captured pageviews, autocaptured clicks/inputs (PostHog
 *     defaults). Disabled element types: password inputs + anything
 *     marked data-ph-no-capture.
 *
 * The SDK itself is dynamically imported via lib/ph.ts so its ~63KB
 * gzip stays out of First Load JS (audit perf-js-03).
 *
 * Session replay privacy (audit secpriv-01): `maskAllInputs: true`.
 * The previous config set it to false with an opt-in [data-ph-mask]
 * selector that NO form ever used — replays recorded raw name/email/
 * ZIP typed into the CCPA privacy-request form and newsletter emails.
 * Mask-by-default is the only safe default on a site with PII forms;
 * genuinely non-sensitive inputs can opt OUT via [data-ph-no-mask]
 * if a replay ever needs them.
 *
 * Replay sampling (audit perf-3p-02): the sample decision is made
 * BEFORE init and passed as `disable_session_recording`, so the ~30KB
 * gzip recorder bundle + rrweb DOM observers never even load for the
 * ~90% of sessions that aren't sampled. (Previously the recorder
 * started for everyone and was stopped post-init for the unsampled.)
 * The decision persists in sessionStorage so an SPA session keeps one
 * consistent replay state.
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

/** Fraction of sessions recorded for replay. 0 disables, 1 records all. */
const REPLAY_SAMPLE_RATE = 0.1;
const REPLAY_SAMPLE_STORAGE_KEY = 'ph_replay_sampled';

function isReplaySampledIn(): boolean {
  try {
    const stored = window.sessionStorage.getItem(REPLAY_SAMPLE_STORAGE_KEY);
    if (stored !== null) return stored === '1';
    const sampled = Math.random() < REPLAY_SAMPLE_RATE;
    window.sessionStorage.setItem(REPLAY_SAMPLE_STORAGE_KEY, sampled ? '1' : '0');
    return sampled;
  } catch {
    // Storage unavailable (private mode edge cases) — skip recording
    // rather than risk over-sampling on every navigation.
    return false;
  }
}

let initialized = false;

function initPostHog() {
  if (initialized || !KEY) return;
  if (typeof window === 'undefined') return;
  initialized = true;
  const sampledIn = isReplaySampledIn();
  void loadPostHog().then((posthog) => {
    posthog.init(KEY, {
      api_host: HOST,
      // PostHog captures every pageview by default via SPA navigation
      // tracking — but Next.js App Router uses client-side navigation
      // that PostHog's auto-capture doesn't see. We fire $pageview
      // manually below via usePathname / useSearchParams.
      capture_pageview: false,
      // Autocapture: clicks, form submits, input changes. Filters out
      // password fields automatically. Add `data-ph-no-capture` to any
      // element that should never be tracked (e.g., promo codes).
      autocapture: true,
      session_recording: {
        // Mask-by-default (audit secpriv-01) — see header comment.
        maskAllInputs: true,
        maskTextSelector: '[data-ph-mask]',
        maskInputOptions: { password: true },
      },
      // Sample decided pre-init so the recorder bundle only loads for
      // sampled-in sessions (audit perf-3p-02).
      disable_session_recording: !sampledIn,
      persistence: 'localStorage+cookie',
      // Privacy: respect Do Not Track headers + GDPR opt-out cookie.
      respect_dnt: true,
      // Disable PostHog's automatic person-profile creation on every event
      // (we identify on signed-in actions only). Lowers event-volume costs.
      person_profiles: 'identified_only',
    });
    // Stamp utm_*/click-id/referrer onto super-properties + person-row
    // so every downstream event carries acquisition source without each
    // call site having to thread it through.
    registerAttribution();
  });
}

/**
 * PostHog provider. Mounts once at the root layout. Initializes the SDK
 * on first client render and fires a $pageview on every route change.
 *
 * Renders nothing — pure side-effect component.
 */
export function AnalyticsPostHog() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // QA #224: don't track internal admin traffic. Otherwise the
  // dashboard pollutes the very metrics it reports — staff loading
  // /admin was showing up in the Top entry pages card with
  // its own sessions + bounce rate. Pathname check is sufficient: the
  // SDK never initializes on admin routes, so no $pageview, no
  // autocapture, no session replay.
  const isAdmin = pathname?.startsWith('/admin') ?? false;

  useEffect(() => {
    if (isAdmin) return;
    initPostHog();
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin || !KEY || !initialized) return;
    // Fire pageview on every Next.js route change. URL search params are
    // included so funnel filters can split by source / utm / sort.
    // withPostHog queues until the lazy SDK chunk lands, so the first
    // pageview isn't lost during the load window.
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    withPostHog((posthog) => posthog.capture('$pageview', { $current_url: url }));
  }, [pathname, searchParams, isAdmin]);

  return null;
}
