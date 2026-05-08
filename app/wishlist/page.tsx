import type { Metadata } from 'next';
import Link from 'next/link';
import { WishlistView } from './wishlist-view';

export const metadata: Metadata = {
  title: 'Saved mattresses — LA Mattress Store',
  description: 'Mattresses you’ve saved on this device. No account needed.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/wishlist' },
};

/**
 * /wishlist — saved-items page (design handoff §Account · Saved items).
 *
 * Server-renders the chrome (breadcrumbs, hero copy, schema-ish header)
 * and defers the actual saved-card grid to <WishlistView />, which is a
 * client component that reads `la-mattress.wishlist.v1` from
 * localStorage. The header copy stays consistent regardless of whether
 * the visitor has anything saved — the empty state lives inside the
 * client component so the SSR shell never flashes a misleading
 * "0 saved" before hydrate.
 */
export default function WishlistPage() {
  return (
    <main className="container" style={{ padding: 'var(--s-7) 0 var(--s-9)' }}>
      <nav className="lp-breadcrumbs">
        <Link href="/">Home</Link>
        <span className="sep">/</span>
        <span>Saved</span>
      </nav>

      <header className="wishlist-header">
        <div className="eyebrow">Your shortlist</div>
        <h1 className="h-display">Saved mattresses.</h1>
        <p className="muted wishlist-lede">
          Tap the heart on any mattress to keep it here. The list lives in your browser — no account, no
          email — and stays put across visits on this device.
        </p>
      </header>

      <section className="section-tight" style={{ paddingTop: 'var(--s-6)' }}>
        <WishlistView />
      </section>
    </main>
  );
}
