'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { useEffect, useState } from 'react';
import { withPostHog } from '@/lib/ph';
import { isOptedOut } from '@/lib/privacy-optout';

// GA4 client-side analytics. Wired in Phase 277 (SEO measurement plan).
//
// Gated on NEXT_PUBLIC_GA_MEASUREMENT_ID so dev/staging without a GA4
// property just renders nothing — matches the Sentry no-op pattern in
// instrumentation-client.ts. Set NEXT_PUBLIC_GA_MEASUREMENT_ID in Vercel
// env vars (all 3 environments) to turn it on.
//
// strategy="lazyOnload" (audit perf-3p-05): afterInteractive still made
// Next emit a <link rel="preload"> for gtag.js in <head>, so the ~130KB
// transfer started in parallel with the LCP hero image on every page —
// contradicting this file's own original "doesn't compete with LCP"
// rationale. lazyOnload defers the fetch until window load; analytics
// gains nothing from arriving earlier, and GA4's queueing dataLayer
// still captures the initial pageview.
//
// Core Web Vitals go to exactly ONE sink (audit perf-3p-04): PostHog,
// as `web_vital` events — that's what the /admin dashboard queries for
// per-route CWV. The previous triple-forwarding (GA4 + PostHog + Vercel
// Speed Insights) collected the same metric three times on every page.
// The PostHog fire lives here, not in analytics-posthog.tsx, because
// Next.js's useReportWebVitals must be called exactly once per page.

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function AnalyticsGa4() {
  // QA #224: skip GA4 on /admin/* so internal staff traffic doesn't
  // skew the same site-wide funnel + acquisition data the dashboard
  // pulls from PostHog (and GA4 mirrors).
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') ?? false;

  useReportWebVitals((metric) => {
    if (isAdmin) return;

    // PostHog — the single CWV sink. Captures the raw float value so
    // HogQL aggregations (median/p75) work directly without re-scaling
    // CLS. `metric_path` lets the dashboard slice CWV per route. The
    // lazy loader queues until the SDK chunk lands; environments
    // without a PostHog key never load the SDK and the queued no-ops
    // are dropped with it.
    withPostHog((ph) =>
      ph.capture('web_vital', {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_id: metric.id,
        metric_rating: metric.rating,
        metric_path: pathname,
      }),
    );
  });

  // CCPA sale/share opt-out (Round 13): browsers signalling Global
  // Privacy Control or carrying the first-party opt-out never load GA4
  // — the one tag on the site that could constitute "sharing" under
  // the CCPA. Decided post-mount (useEffect) so server HTML is
  // identical for all visitors; GA4 was lazyOnload anyway, so gating
  // it behind hydration costs nothing. Default false = don't load
  // until we've positively checked the signals.
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    setAllowed(!isOptedOut());
  }, []);

  if (!MEASUREMENT_ID || isAdmin || !allowed) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
        strategy="lazyOnload"
      />
      <Script id="ga4-init" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${MEASUREMENT_ID}', { send_page_view: true });
        `}
      </Script>
    </>
  );
}
