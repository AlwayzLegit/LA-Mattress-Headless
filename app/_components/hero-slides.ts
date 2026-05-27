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
    eyebrow: 'Try before you buy · 5 LA showrooms',
    title: 'The Los Angeles\nmattress store.',
    body: '5 mattress stores across Los Angeles — Koreatown, Studio City, Glendale, West LA, and La Brea. Lie down on every mattress we sell, then book free white-glove delivery.',
    primary:   { label: 'Find a store',         icon: 'pin',         href: '/pages/mattress-store-locations' },
    secondary: { label: 'Book an appointment',                       href: '/pages/mattress-store-contact' },
    // Alt text serves SEO (image search + a11y). Phase 302: tighten from
    // bare "Koreatown showroom interior" to a geo-keyword-bearing variant
    // that mirrors the H1 ranking phrase. Image-search results for
    // "los angeles mattress store" are a meaningful organic channel for
    // showroom traffic, and this slide is the LCP-candidate image —
    // crawlers index it heavily.
    bgImage: { url: imgUrl('hero-showroom'), altText: 'LA Mattress Store Koreatown showroom interior in Los Angeles' },
  },
  {
    eyebrow: 'Premium brands · Same-day Los Angeles delivery',
    title: 'Sleep, engineered\nin Los Angeles.',
    body: 'Tempur-Pedic, Stearns & Foster, Helix, Diamond and more — delivered across Los Angeles, often the same day.',
    primary:   { label: 'Shop mattresses',     icon: 'arrow-right', href: '/collections/mattresses' },
    secondary: { label: 'Take the 2-min quiz',                      href: '/sleep-quiz' },
    // Phase 302: was "Brand lifestyle bedroom" — generic stock-photo
    // alt-text with zero geo signal. Replaced with a descriptive
    // variant that calls out the brand category (premium mattresses)
    // and ties the image back to the LA store context.
    bgImage: { url: imgUrl('lifestyle-bedroom'), altText: 'Premium mattress bedroom set sold at LA Mattress Store in Los Angeles' },
  },
  {
    // Phase 302: was "Memorial Day Event" — that string lived in the
    // fallback long enough to land in the prod-rendered HTML once the
    // dated `hero_slide` metaobject for memorial-day-2026 aged past
    // its `ends_at` window. Replaced with an evergreen eyebrow so the
    // fallback path never serves a stale holiday string between when
    // one sale ends and the next is configured in Shopify Admin.
    eyebrow: 'Clearance event · Floor models',
    title: 'Up to\n60% off.',
    body: 'Markdowns on every floor model, plus free upgrades on king sizes. Limited stock at every showroom.',
    primary:   { label: 'Shop the sale',  icon: 'arrow-right', href: '/collections/on-sale' },
    secondary: { label: 'See all deals',                       href: '/collections/floor-model-discontinued-mattress-clearance-sale' },
    // Phase 302: was "Sale event composition" — opaque art-direction
    // term that did nothing for image-search ranking or a11y. New
    // alt carries the keyword + geo modifier.
    bgImage: { url: imgUrl('lifestyle-couple'), altText: 'Floor model mattress sale at LA Mattress Store Los Angeles showroom' },
    accent: true,
  },
];
