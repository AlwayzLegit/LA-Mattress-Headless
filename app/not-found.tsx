import Link from 'next/link';
import { Icon } from './_components/icon';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';
import { RecentlyViewedRail } from './_components/recently-viewed';

const CATEGORIES: { label: string; href: string; sub?: string }[] = [
  { label: 'Mattresses',         href: '/collections/mattresses',           sub: 'All sizes & brands' },
  { label: 'Tempur-Pedic',       href: '/collections/tempur-pedic-mattresses', sub: 'Memory foam, premium' },
  { label: 'Stearns & Foster',   href: '/collections/stearns-foster-mattresses', sub: 'Luxury hybrids' },
  { label: 'Diamond Mattress',   href: '/collections/diamond-mattresses',   sub: 'California-made' },
  { label: 'On Sale',            href: '/collections/on-sale',              sub: 'Current markdowns' },
  { label: 'Adjustable Bases',   href: '/collections/adjustable-beds',      sub: 'Pair with any mattress' },
];

export default function NotFound() {
  return (
    <>
      <main className="container" style={{ padding: 'var(--s-8) 0 var(--s-7)' }}>
        <div style={{ maxWidth: 720 }}>
          <div className="eyebrow">404</div>
          <h1 className="h-display" style={{ margin: 'var(--s-4) 0 var(--s-5)' }}>
            Lost in<br />the night.
          </h1>
          <p className="muted" style={{ fontSize: 18, lineHeight: 1.5, maxWidth: '50ch', marginBottom: 'var(--s-6)' }}>
            The page you&rsquo;re looking for doesn&rsquo;t exist — maybe a discontinued product or an old promotion. Pick a category to keep shopping, or call us and we&rsquo;ll find what you&rsquo;re after.
          </p>
        </div>

        <div className="nf-grid">
          {CATEGORIES.map((c) => (
            <Link key={c.href} href={c.href} className="nf-tile">
              <div className="nf-tile-label">{c.label}</div>
              {c.sub ? <div className="nf-tile-sub muted">{c.sub}</div> : null}
              <Icon name="arrow-right" size={16} />
            </Link>
          ))}
        </div>

        <ul className="nf-secondary">
          <li><Link href="/" className="link-arrow">Home <Icon name="arrow-right" size={14} /></Link></li>
          <li><Link href="/pages/mattress-store-locations" className="link-arrow">Find a store <Icon name="arrow-right" size={14} /></Link></li>
          <li><Link href="/sleep-quiz" className="link-arrow">Take the sleep quiz <Icon name="arrow-right" size={14} /></Link></li>
          <li><a href={`tel:${SITE_PHONE_TEL}`} className="link-arrow">Call us at {SITE_PHONE_DISPLAY} <Icon name="phone" size={14} /></a></li>
        </ul>
      </main>
      <RecentlyViewedRail heading="Or pick up where you left off" eyebrow="Recently viewed" />
    </>
  );
}
