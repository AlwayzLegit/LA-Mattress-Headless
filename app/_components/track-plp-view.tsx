'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

/**
 * Fires a `plp_view` event once on mount for the collection page.
 *
 * Client component because the analytics SDK is browser-only and we
 * need the effect to run after hydration. The parent server component
 * passes in the values it already has (so we don't double-fetch).
 *
 * The `intro_source` and `long_content_source` props tell PostHog which
 * data path actually rendered (metafield vs code fallback / seo_content
 * vs descriptionHtml vs neither). This powers the v2.1 layout-impact
 * funnel splits in the dashboard.
 */
export function TrackPlpView({
  handle,
  title,
  layout,
  introSource,
  longContentSource,
  productCount,
}: {
  handle: string;
  title?: string;
  layout: 'v1' | 'v2';
  introSource: 'metafield' | 'fallback';
  longContentSource: 'seo_content' | 'description_html' | 'none';
  productCount?: number;
}) {
  useEffect(() => {
    track('plp_view', {
      handle,
      title,
      layout,
      intro_source: introSource,
      long_content_source: longContentSource,
      product_count: productCount,
    });
  }, [handle, title, layout, introSource, longContentSource, productCount]);

  return null;
}
