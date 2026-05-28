/**
 * Per-handle configuration for the ServicePage template — the
 * "confidence" pages (financing, warranty, comfort exchange, delivery,
 * contact) that render rich merchant-authored CMS bodies inside a
 * shared visual chrome (hero + trust strip + sticky TOC + CTA strip).
 *
 * Why a config table instead of per-page custom components:
 *   - Merchant content stays editable in Shopify Admin → Pages, so the
 *     copy can evolve without code changes.
 *   - Visual upgrades (trust strip, hero, CTA) live in code, where they
 *     should — they're brand-level decisions, not page content.
 *   - One template, one CSS surface, five configured instances. New
 *     pages added by appending an entry here + listing the handle in
 *     SERVICE_PAGE_HANDLES.
 */

import type { IconName } from '@/app/_components/icon';

export type ServicePageConfig = {
  /** Small uppercase label above the H1. */
  eyebrow: string;
  /** One-sentence intro under the H1 — what this page answers in plain English. */
  lede: string;
  /** Three trust items rendered as an icon strip under the hero. */
  trust: Array<{ icon: IconName; title: string; sub: string }>;
  /** End-of-page CTA strip — usually one primary action + one secondary. */
  cta: {
    headline: string;
    primary: { label: string; href: string };
    secondary?: { label: string; href: string };
  };
};

export const SERVICE_PAGE_HANDLES = [
  'mattress-store-financing',
  'warranty',
  'love-your-bed-guarantee',
  'mattress-store-delivery',
  'mattress-store-contact',
  'about',
] as const;

export type ServicePageHandle = (typeof SERVICE_PAGE_HANDLES)[number];

export function isServicePage(handle: string): handle is ServicePageHandle {
  return (SERVICE_PAGE_HANDLES as readonly string[]).includes(handle);
}

export const SERVICE_PAGES: Record<ServicePageHandle, ServicePageConfig> = {
  'mattress-store-financing': {
    eyebrow: '0% APR · Synchrony & Acima',
    lede: 'Spread the cost without paying interest. Instant approval, no down payment, same-day delivery on approved orders.',
    trust: [
      { icon: 'card', title: '0% APR financing', sub: 'Synchrony retail credit + Acima lease-to-own' },
      { icon: 'check', title: 'Instant approval', sub: 'Most applicants approved in seconds' },
      { icon: 'truck', title: 'Same-day delivery', sub: 'Order by 4 PM on approved plans' },
    ],
    cta: {
      headline: 'Find your mattress, then apply at checkout.',
      primary: { label: 'Browse mattresses', href: '/collections/mattresses' },
      secondary: { label: 'Take the 2-minute quiz', href: '/sleep-quiz' },
    },
  },
  warranty: {
    eyebrow: 'Up to 25 years of coverage',
    lede: 'Every mattress we sell is backed by the manufacturer’s warranty against defects. Here’s what’s covered, what isn’t, and how to file a claim.',
    trust: [
      { icon: 'shield', title: 'Manufacturer-backed', sub: 'Tempur-Pedic, Sealy, Stearns & Foster + more' },
      { icon: 'phone', title: 'We file the claim for you', sub: 'Photos in, submission handled, decision relayed' },
      { icon: 'check', title: '120-night comfort exchange', sub: 'Separate from warranty — covers preference' },
    ],
    cta: {
      headline: 'Have a warranty question or claim to file?',
      primary: { label: 'Call (800) 218-3578', href: 'tel:+18002183578' },
      secondary: { label: 'See the 120-night guarantee', href: '/pages/love-your-bed-guarantee' },
    },
  },
  'love-your-bed-guarantee': {
    eyebrow: '120-night comfort exchange',
    lede: 'Sleep on it for at least 30 nights. If it isn’t right, swap it for any other mattress within 120 nights of delivery — we handle the pickup, drop-off, and recycling.',
    trust: [
      { icon: 'check', title: 'One exchange per purchase', sub: 'Any other in-stock mattress, any brand, any size' },
      { icon: 'truck', title: 'Pickup + redelivery included', sub: 'We haul the original to CA mattress recycling' },
      { icon: 'shield', title: 'No restocking fees', sub: 'Pay only the price difference if any' },
    ],
    cta: {
      headline: 'Choose with confidence.',
      primary: { label: 'Browse mattresses', href: '/collections/mattresses' },
      secondary: { label: 'Take the 2-minute quiz', href: '/sleep-quiz' },
    },
  },
  'mattress-store-delivery': {
    eyebrow: 'Free white-glove delivery',
    lede: 'Free delivery on every order over $499 across LA. Order by 4 PM and we often deliver the same day — setup, old-mattress haul-away, and stair carry all included.',
    trust: [
      { icon: 'truck', title: 'Same-day in LA', sub: 'On in-stock orders placed by 4 PM' },
      { icon: 'check', title: 'White-glove setup', sub: 'Bedroom delivery, full setup, packaging removed' },
      { icon: 'shield', title: 'Free old-mattress haul', sub: 'We recycle it through CA’s program' },
    ],
    cta: {
      headline: 'Ready to schedule delivery?',
      primary: { label: 'Browse mattresses', href: '/collections/mattresses' },
      secondary: { label: 'Find your closest showroom', href: '/pages/mattress-store-locations' },
    },
  },
  'mattress-store-contact': {
    eyebrow: 'Real local team, no call center',
    lede: 'Every call, email, and chat goes to a salaried sleep consultant at one of our LA showrooms — no offshored support, no scripts.',
    trust: [
      { icon: 'phone', title: '(800) 218-3578', sub: '10 AM – 8 PM Pacific, daily' },
      { icon: 'mail', title: 'orders.lamattress@gmail.com', sub: 'Reply within one business day' },
      { icon: 'pin', title: '5 LA showrooms', sub: 'Walk-ins welcome, no appointment needed' },
    ],
    cta: {
      headline: 'Prefer to swing by?',
      primary: { label: 'See all showroom locations', href: '/pages/mattress-store-locations' },
      secondary: { label: 'Call (800) 218-3578', href: 'tel:+18002183578' },
    },
  },
  about: {
    eyebrow: 'LA-owned · 5 showrooms · since 2012',
    lede: 'A family-owned LA mattress store with five neighborhood showrooms, salaried sleep consultants, and free white-glove delivery across the city. The brands you know, the prices you compare, the service that makes the difference.',
    trust: [
      { icon: 'home', title: 'Family-owned in LA', sub: 'Five showrooms across the city' },
      { icon: 'check', title: 'Salaried, never commission', sub: 'No upsell pressure — you pick what fits you' },
      { icon: 'shield', title: '120-night Love Your Bed exchange', sub: 'If it isn’t right, we swap it' },
    ],
    cta: {
      headline: 'Come see what we mean.',
      primary: { label: 'Find your closest showroom', href: '/pages/mattress-store-locations' },
      secondary: { label: 'Browse mattresses', href: '/collections/mattresses' },
    },
  },
};
