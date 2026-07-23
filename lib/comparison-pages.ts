/**
 * Per-handle configuration for the ComparisonPage template — the
 * editorial "X vs Y" pages (brand-vs-brand and retailer-vs-retailer)
 * that render a rich merchant-authored CMS body (verdict, side-by-side
 * table, category breakdowns, FAQ) inside a shared visual chrome:
 *
 *   - Breadcrumb
 *   - "VS" hero (eyebrow + two name plates split by a VS badge + h1 +
 *     lede + "last updated")
 *   - 3-item trust strip
 *   - Body (merchant HTML) + sticky right-rail TOC on desktop, with the
 *     raw comparison <table> restyled into a scannable, responsive grid
 *   - End-of-page CTA strip
 *
 * Same philosophy as lib/service-pages.ts: merchant content stays
 * editable in Shopify Admin → Pages; only the brand-level chrome (hero
 * plates, trust strip, CTA) lives in code. New comparison pages are
 * added by appending an entry here + listing the handle in
 * COMPARISON_PAGE_HANDLES — no new component per page.
 */

import type { IconName } from '@/app/_components/icon';

export type ComparisonSide = {
  /** Display name on the hero plate (e.g. "Tempur-Pedic", "Purple"). */
  name: string;
  /** One-line differentiator under the name (e.g. "Cooling GelFlex grid"). */
  tagline: string;
};

export type ComparisonPageConfig = {
  /** Small uppercase label above the VS hero. */
  eyebrow: string;
  /** The two contenders, rendered left + right of the VS badge. */
  sides: [ComparisonSide, ComparisonSide];
  /** One-sentence intro under the H1 — the framing in plain English. */
  lede: string;
  /** Three trust items rendered as an icon strip under the hero. */
  trust: Array<{ icon: IconName; title: string; sub: string }>;
  /** End-of-page CTA strip — primary action (+ optional secondary). */
  cta: {
    headline: string;
    primary: { label: string; href: string };
    secondary?: { label: string; href: string };
  };
};

export const COMPARISON_PAGE_HANDLES = [
  'purple-mattress-vs-tempur-pedic',
  'mattress-firm-vs-la-mattress-store',
] as const;

export type ComparisonPageHandle = (typeof COMPARISON_PAGE_HANDLES)[number];

export function isComparisonPage(handle: string): handle is ComparisonPageHandle {
  return (COMPARISON_PAGE_HANDLES as readonly string[]).includes(handle);
}

export const COMPARISON_PAGES: Record<ComparisonPageHandle, ComparisonPageConfig> = {
  'purple-mattress-vs-tempur-pedic': {
    eyebrow: 'Brand comparison · Grid vs memory foam',
    // Hero plate order mirrors the page title ("Purple … vs. Tempur-Pedic").
    sides: [
      { name: 'Purple', tagline: 'Cooling GelFlex grid · bouncy, “floating” feel' },
      { name: 'Tempur-Pedic', tagline: 'TEMPUR memory foam · body-hugging contour' },
    ],
    lede: 'Two premium brands, two completely different feels. Here’s how Purple’s cooling grid stacks up against Tempur-Pedic’s memory foam, and how to pick the one that fits your body.',
    trust: [
      { icon: 'check', title: 'Try both in our showrooms', sub: 'Purple and Tempur-Pedic on the floor at all 5 LA stores' },
      { icon: 'truck', title: 'Free white-glove delivery', sub: 'Same-day across LA on orders over $499' },
      { icon: 'card', title: '0% APR financing', sub: 'Synchrony or Acima on approved credit' },
    ],
    cta: {
      headline: 'Ready to feel the difference for yourself?',
      primary: { label: 'Find your closest showroom', href: '/pages/mattress-store-locations' },
      secondary: { label: 'Take the 2-minute sleep quiz', href: '/sleep-quiz' },
    },
  },
  'mattress-firm-vs-la-mattress-store': {
    eyebrow: 'Retailer comparison',
    sides: [
      { name: 'LA Mattress Store', tagline: 'Local · expert consultants · same-day delivery' },
      { name: 'Mattress Firm', tagline: 'National chain · 2,200+ stores' },
    ],
    lede: 'The same brands and SKUs sell at both, the difference is everything around the bed. Here’s how a local, family-owned LA store compares to a national chain on price, delivery, and service.',
    trust: [
      { icon: 'check', title: 'Trained on every brand', sub: 'Expert help, no upsell pressure, you pick what fits you' },
      { icon: 'truck', title: 'Free same-day LA delivery', sub: 'White-glove setup + old-mattress haul-away' },
      { icon: 'shield', title: '120-night Love Your Bed exchange', sub: 'Longer than the brand trial, no restocking fee' },
    ],
    cta: {
      headline: 'See the difference in person.',
      primary: { label: 'Find your closest showroom', href: '/pages/mattress-store-locations' },
      secondary: { label: 'Browse mattresses', href: '/collections/mattresses' },
    },
  },
};
