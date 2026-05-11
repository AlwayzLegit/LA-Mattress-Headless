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
  eager,
  priority,
}: {
  src: string;
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
      alt=""
      fill
      priority={priority}
      fetchPriority={priority ? 'high' : 'auto'}
      sizes="100vw"
      quality={75}
      className="hero-bg-img"
    />
  );
}
