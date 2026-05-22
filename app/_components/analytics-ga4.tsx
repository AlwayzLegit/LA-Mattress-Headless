'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import posthog from 'posthog-js';

// GA4 client-side analytics. Wired in Phase 277 (SEO measurement plan).
//
// Gated on NEXT_PUBLIC_GA_MEASUREMENT_ID so dev/staging without a GA4
// property just renders nothing — matches the Sentry no-op pattern in
// instrumentation-client.ts. Set NEXT_PUBLIC_GA_MEASUREMENT_ID in Vercel
// env vars (all 3 environments) to turn it on.
//
// strategy="afterInteractive" defers loading until after hydration so GA4
// doesn't compete with the LCP image / fonts. The site already uses Vercel
// Analytics for first-party traffic data; GA4 is added on top to unlock
// Search Console keyword attribution (which GA4-Search Console integration
// requires).
//
// Core Web Vitals (LCP / CLS / INP / FCP / TTFB) are forwarded BOTH to
// GA4 (alongside Vercel Speed Insights) AND to PostHog as `web_vital`
// events. The PostHog fire lives here, not in analytics-posthog.tsx,
// because Next.js's useReportWebVitals must be called exactly once per
// page; consolidating both forwards in this single hook is the
// documented pattern.

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

    // GA4 forwarding (existing behavior — only when GA4 is configured
    // and the gtag script has loaded).
    if (MEASUREMENT_ID && typeof window.gtag === 'function') {
      // Standard GA4 web-vitals event payload (matches the official
      // web-vitals → GA4 recipe). value is rounded to an integer
      // because GA4 stores event params as int64. CLS multiplied by
      // 1000 to preserve precision in the same int64 store.
      window.gtag('event', metric.name, {
        event_category: 'Web Vitals',
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_label: metric.id,
        non_interaction: true,
      });
    }

    // PostHog forwarding — independent of GA4. Captures the raw float
    // value so HogQL aggregations (median/p75) work directly without
    // re-scaling CLS. `metric_path` lets the dashboard slice CWV per
    // route. PostHog gates init on its own KEY env var; if uninitialized,
    // `posthog.capture` is a no-op.
    posthog.capture('web_vital', {
      metric_name: metric.name,
      metric_value: metric.value,
      metric_id: metric.id,
      metric_rating: metric.rating,
      metric_path: pathname,
    });
  });

  if (!MEASUREMENT_ID || isAdmin) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
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
