'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';

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
// Core Web Vitals (LCP / CLS / INP / FCP / TTFB) are forwarded as GA4
// events via useReportWebVitals — gives a CWV-per-page dashboard that
// matches the field data Google ranks on, alongside Vercel Speed Insights.

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
    if (isAdmin || !MEASUREMENT_ID || typeof window.gtag !== 'function') return;
    // Standard GA4 web-vitals event payload (matches the official
    // web-vitals → GA4 recipe). value is rounded to an integer because
    // GA4 stores event params as int64.
    window.gtag('event', metric.name, {
      event_category: 'Web Vitals',
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      event_label: metric.id,
      non_interaction: true,
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
