'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';

/**
 * Tracks sale-page engagement: fires one `sale_page_view` on mount,
 * then delegates all CTA clicks within the page via a single
 * onClick handler attached to <main> (event delegation).
 *
 * Why delegation: the SalePage server component renders 5+ CTAs
 * (hero primary, hero secondary, grid footer, page footer primary,
 * page footer secondary). Wrapping each in its own client tracker
 * would mean 5 hydration islands instead of one. Delegation keeps
 * the bundle small and lets new CTAs auto-track as long as they
 * carry the `data-cta` + `data-cta-position` attributes the
 * SalePage hero/footer markup is now sprinkled with.
 */
export function SalePageCtaTracker({
  handle,
  saleStartsAt,
  saleEndsAt,
  isPreLaunch,
  isPostSale,
  isPreview,
  featuredProductCount,
}: {
  handle: string;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  isPreLaunch: boolean;
  isPostSale: boolean;
  isPreview: boolean;
  featuredProductCount: number;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track('sale_page_view', {
      handle,
      sale_starts_at: saleStartsAt ?? undefined,
      sale_ends_at: saleEndsAt ?? undefined,
      is_pre_launch: isPreLaunch,
      is_post_sale: isPostSale,
      is_preview: isPreview,
      featured_product_count: featuredProductCount,
    });
  }, [handle, saleStartsAt, saleEndsAt, isPreLaunch, isPostSale, isPreview, featuredProductCount]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest<HTMLElement>('[data-cta]');
      if (!el) return;
      const cta = el.getAttribute('data-cta');
      const position = el.getAttribute('data-cta-position');
      if (cta !== 'shop_the_sale' && cta !== 'find_a_showroom' && cta !== 'sleep_quiz' && cta !== 'see_every_mattress') return;
      if (position !== 'hero' && position !== 'footer' && position !== 'grid') return;
      track('sale_page_cta_click', { handle, cta, position });
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [handle]);

  return null;
}
