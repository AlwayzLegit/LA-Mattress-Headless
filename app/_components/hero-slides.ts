import type { HeroSlideData } from '@/lib/shopify';
import { imgUrl } from './images';

/**
 * Homepage hero carousel slide definitions — FALLBACK only.
 *
 * Phase 267: hero slides are now sourced from `hero_slide` Shopify
 * metaobjects via `lib/shopify/queries/hero-slides.ts`. This file
 * keeps the original 3-slide content as the fallback for when:
 *   - Shopify isn't configured
 *   - the merchant hasn't created the metaobjects yet
 *   - the Storefront fetch fails
 *
 * Hero 0 is the LCP candidate — server-rendered with `priority={true}`
 * and `fetchPriority="high"` (see hero-slide-image.tsx). Subsequent
 * slides defer their image render until after hydration to avoid the
 * browser fetching three hero-sized images on initial paint (Phase 162).
 */
export type HeroSlide = HeroSlideData;

export const FALLBACK_HERO_SLIDES: HeroSlide[] = [
  {
    eyebrow: '5 LA Showrooms',
    title: 'Try before\nyou buy.',
    body: 'Lie down on every mattress we sell, in person, at a showroom near you. Open daily across Los Angeles.',
    primary:   { label: 'Find a store',         icon: 'pin',         href: '/pages/mattress-store-locations' },
    secondary: { label: 'Book an appointment',                       href: '/pages/mattress-store-contact' },
    bgImage: { url: imgUrl('hero-showroom'), altText: 'Koreatown showroom interior' },
  },
  {
    eyebrow: 'Premium Brands · Same-Day Delivery',
    title: 'Sleep, engineered\nin Los Angeles.',
    body: 'Tempur-Pedic, Stearns & Foster, Helix, Diamond and more — delivered to your door, often the same day.',
    primary:   { label: 'Shop mattresses',     icon: 'arrow-right', href: '/collections/mattresses' },
    secondary: { label: 'Take the 2-min quiz',                      href: '/sleep-quiz' },
    bgImage: { url: imgUrl('lifestyle-bedroom'), altText: 'Brand lifestyle bedroom' },
  },
  {
    eyebrow: 'Memorial Day Event',
    title: 'Up to\n60% off.',
    body: 'Markdowns on every floor model, plus free upgrades on king sizes. Limited stock at every showroom.',
    primary:   { label: 'Shop the sale',  icon: 'arrow-right', href: '/collections/on-sale' },
    secondary: { label: 'See all deals',                       href: '/collections/floor-model-discontinued-mattress-clearance-sale' },
    bgImage: { url: imgUrl('lifestyle-couple'), altText: 'Sale event composition' },
    accent: true,
  },
];
