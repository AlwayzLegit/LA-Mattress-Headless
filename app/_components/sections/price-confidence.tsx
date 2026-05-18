import Link from 'next/link';
import { Icon } from '../icon';

// The price-match wording is the company's already-published commitment
// (verbatim from lib/faq.ts HOMEPAGE_FAQ — live on the homepage + its
// FAQPage JSON-LD). Stated here, not invented.
const PRICE_MATCH =
  'Find the same mattress for less at any authorized retailer within 30 days and we’ll refund the difference plus 10%.';

const REASONS: { icon: 'shield' | 'home' | 'truck' | 'card' | 'star'; title: string; body: string }[] = [
  { icon: 'shield', title: 'Authorized dealer', body: 'Genuine Tempur-Pedic, Stearns & Foster, Diamond, Helix and more — never gray-market or knockoff models with mismatched warranties.' },
  { icon: 'home', title: 'Five-showroom buying power', body: 'One family-owned operation across 5 LA showrooms buys deep and prices sharp — the savings pass to you, not a national chain’s ad budget.' },
  { icon: 'star', title: 'Salaried, never commission', body: 'Consultants are paid a salary, so there’s no incentive to upsell you past the right mattress at the right price.' },
  { icon: 'card', title: 'Floor models & clearance', body: 'Discontinued and floor-sample mattresses are marked down hard — ask in any showroom what’s on clearance that week.' },
];

/**
 * Coded /pages/low-price-guarantee page (no Shopify CMS page behind
 * it). Value/confidence framing built only from facts already true
 * site-wide, plus the existing published price-match commitment.
 * WebPage + BreadcrumbList JSON-LD is emitted by the segment layout.
 */
export function PriceConfidencePage() {
  return (
    <main className="container" style={{ paddingTop: 'var(--s-7)', paddingBottom: 'var(--s-9)' }}>
      <article className="cms-page">
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span>Low price guarantee</span>
        </nav>

        <header style={{ margin: 'var(--s-4) 0 var(--s-5)' }}>
          <div className="eyebrow">Shop with confidence</div>
          <h1 className="h1" style={{ marginTop: 'var(--s-3)' }}>Our low price guarantee</h1>
          <p className="muted" style={{ maxWidth: '62ch', marginTop: 'var(--s-3)' }}>
            Great mattresses at honest prices — backed by a real price match and a
            120-night comfort exchange, so the decision is risk-free.
          </p>
        </header>

        <div
          className="gd-side-card-dark"
          style={{ borderRadius: 'var(--r-3)', padding: 'var(--s-5)', marginBottom: 'var(--s-6)' }}
        >
          <h2 className="h2" style={{ margin: 0 }}>Price match + 10%</h2>
          <p style={{ margin: 'var(--s-2) 0 0', maxWidth: '60ch' }}>{PRICE_MATCH}</p>
        </div>

        <section className="section">
          <div className="eyebrow">Why our prices stay competitive</div>
          <ul className="showroom-expect-list" style={{ marginTop: 'var(--s-4)' }}>
            {REASONS.map((r) => (
              <li key={r.title}>
                <Icon name={r.icon} size={18} />
                <span><strong>{r.title}.</strong> {r.body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="section" style={{ marginTop: 'var(--s-6)' }}>
          <div className="eyebrow">Risk-free either way</div>
          <ul className="showroom-chips" aria-label="Buyer protections" style={{ marginTop: 'var(--s-3)' }}>
            <li className="showroom-chip">120-night comfort exchange</li>
            <li className="showroom-chip">Free white-glove delivery over $499</li>
            <li className="showroom-chip">0% APR financing</li>
            <li className="showroom-chip">Try every mattress in 5 LA showrooms</li>
          </ul>
          <div className="showroom-expect-cta" style={{ marginTop: 'var(--s-5)' }}>
            <Link href="/collections/mattresses" className="btn btn-primary">Shop mattresses</Link>
            <Link href="/pages/mattress-store-locations" className="btn btn-ghost">Find a showroom</Link>
            <Link href="/sleep-quiz" className="btn btn-ghost">Take the sleep quiz</Link>
          </div>
        </section>
      </article>
    </main>
  );
}
