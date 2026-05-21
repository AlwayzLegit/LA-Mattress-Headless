import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/app/_components/icon';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';

export const metadata: Metadata = {
  // Next.js auto-injects <meta name="robots" content="noindex"/> on 404.
  title: 'Collection not found',
};

export default function CollectionNotFound() {
  return (
    <main className="container" style={{ paddingTop: 'var(--s-10)', paddingBottom: 'var(--s-10)' }}>
      <div style={{ maxWidth: 720 }}>
        <div className="eyebrow">404 — Collection</div>
        <h1 className="h-display" style={{ margin: 'var(--s-4) 0 var(--s-5)' }}>
          Lost in<br />the night.
        </h1>
        <p className="muted" style={{ fontSize: 18, lineHeight: 1.5, maxWidth: '50ch', marginBottom: 'var(--s-6)' }}>
          That collection doesn&rsquo;t exist anymore — it may have been merged or renamed.
          Try one of these instead:
        </p>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          <li><Link href="/collections/mattresses" className="link-arrow">Shop all mattresses <Icon name="arrow-right" size={14} /></Link></li>
          <li><Link href="/collections/on-sale" className="link-arrow">Current sale <Icon name="arrow-right" size={14} /></Link></li>
          <li><Link href="/search" className="link-arrow">Search the catalog <Icon name="arrow-right" size={14} /></Link></li>
          <li><Link href="/pages/mattress-store-locations" className="link-arrow">Find a store <Icon name="arrow-right" size={14} /></Link></li>
          <li><a href={`tel:${SITE_PHONE_TEL}`} className="link-arrow">Call us at {SITE_PHONE_DISPLAY} <Icon name="phone" size={14} /></a></li>
        </ul>
      </div>
    </main>
  );
}
