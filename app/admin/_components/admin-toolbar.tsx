'use client';

import { useSearchParams } from 'next/navigation';
import { DateRangePicker } from './date-range-picker';
import { RefreshButton } from './refresh-button';
import { parseDateRange, parseCompareFlag } from '@/lib/dashboard/date-range';

/**
 * Sticky top toolbar rendered by app/admin/layout.tsx so every section
 * shares the same date-range picker + refresh button + external-tool
 * links without each page re-implementing them.
 *
 * Client component because the layout itself can't access searchParams
 * (App Router restricts that to page.tsx). useSearchParams reads them
 * client-side from the URL bar so the toolbar stays in sync as the
 * merchant navigates between sections.
 *
 * The external links (Sentry / PostHog / Vercel / Shopify Admin) were
 * previously inline in the page header — moved here so they follow the
 * merchant across all sections instead of disappearing on sub-routes.
 */

const SHOPIFY_ADMIN_HOST =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN
    ? `https://admin.shopify.com/store/${process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN.replace(/\.myshopify\.com$/, '')}`
    : 'https://admin.shopify.com';
const POSTHOG_PROJECT_URL =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_PROJECT_URL
    ? process.env.NEXT_PUBLIC_POSTHOG_PROJECT_URL
    : 'https://us.posthog.com';

export function AdminToolbar() {
  const sp = useSearchParams();
  // parseDateRange wants a plain Record<string, string>; convert from
  // ReadonlyURLSearchParams.
  const params: Record<string, string> = {};
  for (const [k, v] of sp.entries()) params[k] = v;
  const range = parseDateRange(params);
  const compare = parseCompareFlag(params);
  return (
    <div className="dash-toolbar">
      <DateRangePicker active={range} compare={compare} />
      <RefreshButton range={range} compare={compare} />
      <nav className="dashboard-links" aria-label="External tools">
        <a href="https://jetnine.sentry.io/issues/?project=la-mattress-headless" target="_blank" rel="noopener noreferrer">
          Sentry →
        </a>
        <a href={POSTHOG_PROJECT_URL} target="_blank" rel="noopener noreferrer">
          PostHog →
        </a>
        <a href="https://vercel.com/alwayzlegits-projects/la-mattress-headless" target="_blank" rel="noopener noreferrer">
          Vercel →
        </a>
        <a href={`${SHOPIFY_ADMIN_HOST}/`} target="_blank" rel="noopener noreferrer">
          Shopify Admin →
        </a>
      </nav>
    </div>
  );
}
