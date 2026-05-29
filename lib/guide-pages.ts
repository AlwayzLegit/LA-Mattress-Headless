/**
 * Per-handle configuration for the GuidePage template — the editorial
 * buying-guide pages (mattress sizes, mattress types) that render a rich
 * merchant-authored CMS body (size chart, per-size / per-type sections,
 * decision lists) inside the shared service-page chrome:
 *
 *   - Breadcrumb
 *   - Hero (eyebrow + h1 + lede + "last updated")
 *   - 3-item trust strip
 *   - Body (merchant HTML) + sticky right-rail TOC on desktop, with any
 *     raw <table> (e.g. the size chart) restyled into a scannable,
 *     horizontally-scrollable card via the shared .cmp-table-scroll CSS
 *   - End-of-page CTA strip
 *
 * Same philosophy as lib/service-pages.ts + lib/comparison-pages.ts:
 * merchant content stays editable in Shopify Admin → Pages; only the
 * brand-level chrome (eyebrow, trust strip, CTA) lives in code. The
 * config shape is identical to ServicePageConfig, so it's reused.
 *
 * New guide pages are added by appending an entry here + listing the
 * handle in GUIDE_PAGE_HANDLES — no new component per page.
 */

import type { ServicePageConfig } from '@/lib/service-pages';

export type GuidePageConfig = ServicePageConfig;

export const GUIDE_PAGE_HANDLES = ['mattress-sizes', 'mattress-types'] as const;

export type GuidePageHandle = (typeof GUIDE_PAGE_HANDLES)[number];

export function isGuidePage(handle: string): handle is GuidePageHandle {
  return (GUIDE_PAGE_HANDLES as readonly string[]).includes(handle);
}

export const GUIDE_PAGES: Record<GuidePageHandle, GuidePageConfig> = {
  'mattress-sizes': {
    eyebrow: 'Buying guide · Sizes & dimensions',
    lede: 'From Twin to California King — every standard mattress size we stock, with exact dimensions, who each one fits, and the smallest bedroom it works in.',
    trust: [
      { icon: 'check', title: 'Try every size in-store', sub: 'All six sizes on the floor at our 5 LA showrooms' },
      { icon: 'truck', title: 'Free white-glove delivery', sub: 'Same-day across LA on orders over $499' },
      { icon: 'shield', title: '120-night comfort exchange', sub: 'Swap it if the size isn’t right — no restocking fee' },
    ],
    cta: {
      headline: 'Not sure which size fits your room?',
      primary: { label: 'Take the 2-minute sleep quiz', href: '/sleep-quiz' },
      secondary: { label: 'Find your closest showroom', href: '/pages/mattress-store-locations' },
    },
  },
  'mattress-types': {
    eyebrow: 'Buying guide · Mattress types',
    lede: 'Memory foam, hybrid, innerspring, or latex — how the four mattress types actually feel, who each one fits, and what to watch out for.',
    trust: [
      { icon: 'check', title: 'Feel all four types in-store', sub: 'Foam, hybrid, innerspring & latex, side-by-side' },
      { icon: 'truck', title: 'Free white-glove delivery', sub: 'Same-day across LA on orders over $499' },
      { icon: 'shield', title: '120-night comfort exchange', sub: 'Picked the wrong feel? Swap it.' },
    ],
    cta: {
      headline: 'Still deciding which type is right?',
      primary: { label: 'Take the 2-minute sleep quiz', href: '/sleep-quiz' },
      secondary: { label: 'Browse all mattresses', href: '/collections/mattresses' },
    },
  },
};
