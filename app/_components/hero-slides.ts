import type { IconName } from './icon';

/**
 * Homepage hero carousel slide definitions.
 *
 * Lifted out of `hero.tsx` (Phase 194) so the data can be imported
 * from server contexts — the Phase 195 split makes `hero.tsx` a server
 * component that renders the static slide DOM, while a sibling
 * `'use client' HeroController` owns the interactive carousel state.
 * Both need the slide list, but only the controller is client-side.
 *
 * Order is rendering order. Slide 0 is the LCP candidate — it renders
 * with `priority={true}` and `fetchPriority="high"` on its background
 * image (see hero-slide-image.tsx). Subsequent slides defer their
 * image render until after hydration to avoid the browser fetching
 * three hero-sized images on initial paint (Phase 162 optimization;
 * preserved by Phase 195 via the shared `HeroSlideImage` client
 * component).
 */
export type HeroSlide = {
  kind: 'showroom' | 'product' | 'sale';
  eyebrow: string;
  title: string;
  body: string;
  primary: { label: string; icon?: IconName; href: string };
  secondary: { label: string; href: string };
  bgLabel: string;
  bgImg: string;
  accent?: boolean;
};

export const HERO_SLIDES: HeroSlide[] = [
  {
    kind: 'showroom',
    eyebrow: '5 LA Showrooms',
    title: 'Try before\nyou buy.',
    body: 'Lie down on every mattress we sell, in person, at a showroom near you. Open daily across Los Angeles.',
    primary:   { label: 'Find a store',         icon: 'pin',         href: '/pages/mattress-store-locations' },
    secondary: { label: 'Book an appointment',                       href: '/pages/mattress-store-contact' },
    bgLabel: '[Koreatown showroom interior]',
    bgImg: 'hero-showroom',
  },
  {
    kind: 'product',
    eyebrow: 'Premium Brands · Same-Day Delivery',
    title: 'Sleep, engineered\nin Los Angeles.',
    body: 'Tempur-Pedic, Stearns & Foster, Helix, Diamond and more — delivered to your door, often the same day.',
    primary:   { label: 'Shop mattresses',     icon: 'arrow-right', href: '/collections/mattresses' },
    secondary: { label: 'Take the 2-min quiz',                      href: '/sleep-quiz' },
    bgLabel: '[Brand lifestyle bedroom]',
    bgImg: 'lifestyle-bedroom',
  },
  {
    kind: 'sale',
    eyebrow: 'Memorial Day Event',
    title: 'Up to\n60% off.',
    body: 'Markdowns on every floor model, plus free upgrades on king sizes. Limited stock at every showroom.',
    primary:   { label: 'Shop the sale',  icon: 'arrow-right', href: '/collections/on-sale' },
    secondary: { label: 'See all deals',                       href: '/collections/floor-model-discontinued-mattress-clearance-sale' },
    bgLabel: '[Sale event composition]',
    bgImg: 'lifestyle-couple',
    accent: true,
  },
];
