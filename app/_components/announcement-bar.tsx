import Link from 'next/link';
import { Icon } from './icon';
import type { Announcement } from '@/lib/shopify';

/**
 * Phase 266: sitewide sale/announcement bar.
 *
 * Rendered above all content. Replaces (does not stack with) the default
 * TopBar marquee when an active announcement exists — see app/layout.tsx.
 * Visible on mobile (the regular TopBar is hidden below 768px; this bar
 * stays visible at all viewport sizes because sales are the highest-
 * value thing for mobile shoppers to see).
 *
 * Content + on/off comes from a Shopify metaobject — see
 * lib/shopify/queries/announcement.ts for the schema and Admin setup.
 */
export function AnnouncementBar({ data }: { data: Announcement }) {
  const cta = data.ctaLabel && data.ctaHref ? { label: data.ctaLabel, href: data.ctaHref } : null;
  return (
    <div className={`announcement-bar announcement-bar-${data.style}`} role="region" aria-label="Site announcement">
      <div className="container announcement-bar-inner">
        <span className="announcement-bar-message">{data.message}</span>
        {cta ? (
          <Link href={cta.href} className="announcement-bar-cta">
            {cta.label} <Icon name="arrow-right" size={13} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
