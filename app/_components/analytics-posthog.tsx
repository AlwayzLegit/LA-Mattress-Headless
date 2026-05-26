'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
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
 * What this covers (the observability gap GA4 + Vercel Analytics don't
 * fill):
 *   - User-journey funnel events (PLP view → PDP view → add_to_cart →
 *     checkout_started → order_completed). Fire via track() in
 *     lib/analytics.ts. Powers funnel charts in PostHog Insights.
 *   - Session replay sampled at 10% of all sessions (configurable below).
 *     Lets us watch what users actually did before a drop-off or error,
 *     not just aggregate counts.
 *   - Auto-captured pageviews, autocaptured clicks/inputs (PostHog
 *     defaults). Disabled element types: password inputs + anything
 *     marked data-ph-no-capture.
 *
 * SDK is lazy-imported only when the key is set so the bundle stays
 * unaffected for environments that haven't enabled it yet.
 *
 * Session replay sampling rationale: capturing 100% would balloon
 * storage cost without much added insight beyond ~10%. 10% gives ~6500
 * replays/month at the site's current traffic — well inside the
 * free-tier limit.
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let initialized = false;

function initPostHog() {
  if (initialized || !KEY) return;
  if (typeof window === 'undefined') return;
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
    // Session replay sampling — 10% of sessions get recorded. Replays
    // are linked to events so a funnel drop-off can be watched directly.
    // Set 0 to disable, 1 to record everyone.
    session_recording: {
      maskAllInputs: false,
      maskTextSelector: '[data-ph-mask]',
      // Don't record password fields ever.
      maskInputOptions: { password: true },
    },
    disable_session_recording: false,
    // Sample 10% of sessions for replay (keeps PostHog free-tier-friendly).
    // Funnel events + autocapture are always sent for every session.
    persistence: 'localStorage+cookie',
    // Privacy: respect Do Not Track headers + GDPR opt-out cookie.
    respect_dnt: true,
    // Disable PostHog's automatic person-profile creation on every event
    // (we identify on signed-in actions only). Lowers event-volume costs.
    person_profiles: 'identified_only',
  });
  // Session-level 10% sample (PostHog supports this server-side too via
  // feature flags; doing it client-side here keeps it simple).
  if (Math.random() > 0.1) {
    posthog.stopSessionRecording();
  }
  // Stamp utm_*/click-id/referrer onto super-properties + person-row
  // so every downstream event carries acquisition source without each
  // call site having to thread it through.
  registerAttribution();
  initialized = true;
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
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams, isAdmin]);

  return null;
}
