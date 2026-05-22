import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';

/**
 * Root 404 — fires for URLs that don't match ANY route in the app
 * (including paths outside the (storefront) route group).
 *
 * Previously absent → Next.js's bare default 404 ("404: This page
 * could not be found.") rendered for typo URLs. QA 2026-05-22 flagged
 * this as a brand-experience gap; this file plus minimal brand chrome
 * (logo + footer line) replaces the dev-looking default.
 *
 * Distinct from app/(storefront)/not-found.tsx — that one only fires
 * for routes INSIDE the (storefront) group that call notFound() (like
 * a missing product handle). This root file catches everything else
 * (random typo URLs, /admin/... wrong-handle paths that fall through
 * to root, etc.).
 *
 * Kept lean intentionally — no Shopify fetches, no mega-nav, no cart
 * provider. Just the brand wordmark + a 404 hero + a small CTA grid.
 * Fast, safe to render at the edge, no async work.
 */

export const metadata: Metadata = {
  // Next.js automatically emits robots:noindex for 404 responses.
  title: 'Page not found — LA Mattress Store',
};

const CATEGORIES: { label: string; href: string; sub: string }[] = [
  { label: 'Mattresses',         href: '/collections/mattresses',                sub: 'All sizes & brands' },
  { label: 'On Sale',            href: '/collections/on-sale',                    sub: 'Current markdowns' },
  { label: 'Take the sleep quiz', href: '/sleep-quiz',                            sub: '8 questions, 2 minutes' },
  { label: 'Find a showroom',    href: '/pages/mattress-store-locations',         sub: '5 across LA' },
];

export default function RootNotFound() {
  return (
    <>
      {/* Minimal brand chrome — root layout doesn't include the
          storefront Nav/Footer, so the 404 brings its own. */}
      <header style={{ borderBottom: '1px solid var(--line)', padding: '16px 24px' }}>
        <Link href="/" aria-label="LA Mattress home" style={{ display: 'inline-block' }}>
          <Image
            src="/assets/la-mattress-logo.png"
            alt="LA Mattress"
            width={400}
            height={224}
            sizes="68px"
            priority
            style={{ height: 38, width: 'auto' }}
          />
        </Link>
      </header>

      <main className="container" style={{ paddingTop: 'var(--s-8)', paddingBottom: 'var(--s-9)' }}>
        <div style={{ maxWidth: 720 }}>
          <div className="eyebrow">404</div>
          <h1 className="h-display" style={{ margin: 'var(--s-4) 0 var(--s-5)' }}>
            We couldn&rsquo;t<br />find that page.
          </h1>
          <p className="muted" style={{ fontSize: 18, lineHeight: 1.5, maxWidth: '50ch', marginBottom: 'var(--s-6)' }}>
            The URL might be from a discontinued product, an old promotion, or just a typo.
            Pick a starting point below, or call us and we&rsquo;ll help you find what you&rsquo;re after.
          </p>
        </div>

        <div className="nf-grid">
          {CATEGORIES.map((c) => (
            <Link key={c.href} href={c.href} className="nf-tile">
              <div className="nf-tile-label">{c.label}</div>
              <div className="nf-tile-sub muted">{c.sub}</div>
            </Link>
          ))}
        </div>

        <ul className="nf-secondary" style={{ marginTop: 'var(--s-6)' }}>
          <li><Link href="/" className="link-arrow">Back to home →</Link></li>
          <li><a href={`tel:${SITE_PHONE_TEL}`} className="link-arrow">Call {SITE_PHONE_DISPLAY}</a></li>
        </ul>
      </main>

      <footer style={{ borderTop: '1px solid var(--line)', padding: '24px', textAlign: 'center' }} className="muted">
        <small>LA Mattress Store · 5 LA showrooms · Family-owned since 2012</small>
      </footer>
    </>
  );
}
