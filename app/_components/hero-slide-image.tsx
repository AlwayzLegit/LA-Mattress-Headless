'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

/**
 * Wrapper around <Image> that defers mounting for non-eager hero slides.
 *
 * Phase 162 found that SSR-emitting all 3 hero-sized images caused the
 * browser to fetch ~400KB extra on first paint — the inactive slides
 * were opacity:0 but still had layout, so the browser's lazy-loading
 * IntersectionObserver treated them as in-viewport. Deferring the
 * non-active slide images until after hydration keeps the LCP
 * candidate (slide 0) hot while skipping the wasted upfront fetches.
 *
 * Phase 195 split: Hero is now a server component, so the deferral
 * logic moved here — a tiny client-only image wrapper used inside the
 * server-rendered slide DOM. Slide 0 passes `eager={true}` and
 * renders at SSR time with `priority` / `fetchPriority="high"`.
 * Slides 1+2 pass `eager={false}` and render `null` at SSR; their
 * `<Image>` mounts after hydration, at which point the carousel
 * cross-fade is already orchestrated by the controller.
 */
export function HeroSlideImage({
  src,
  alt,
  eager,
  priority,
}: {
  src: string;
  // Phase 267: passed in from the parent so the slide's bg_image_alt
  // (or the Shopify MediaImage's altText fallback) can be authored
  // alongside the image in Shopify Admin instead of hardcoded here.
  alt: string;
  eager: boolean;
  priority: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!eager && !mounted) return null;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      fetchPriority={priority ? 'high' : 'auto'}
      // Phase 256: tell Next.js the hero renders at 50vw on phones even
      // though it's 100vw on screen. With sizes="100vw" + DPR 3 on a 375px
      // phone, Next picks the 1200px-wide deviceSize from Unsplash; setting
      // 50vw on mobile drops the picked source to 640px-wide. The hero is
      // a deliberately blurred photographic background overlaid with a
      // dark gradient and foreground text — upscaling a 640px source to a
      // 375px display is visually undetectable. PSI rev-1 (2026-05-12)
      // showed LCP 4.4s mobile with ~600 KB hero; halving the served res
      // brings the image to ~180–220 KB and is the single biggest LCP win
      // available without a hero-image overhaul.
      sizes="(max-width: 768px) 50vw, 100vw"
      // Phase 256: quality 55 → 50. Diminishing returns at this point but
      // every extra ~10 KB saved on the LCP candidate counts when the
      // total mobile-throttled download budget for sub-2.5s LCP is tight.
      quality={50}
      className="hero-bg-img"
    />
  );
}
