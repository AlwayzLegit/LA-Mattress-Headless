import Link from 'next/link';
import { Icon } from '../icon';
import { resolveFaqPageSections } from '@/lib/faq';
import { getFaqItems } from '@/lib/shopify';
import { renderFaqAnswer } from '@/lib/faq-render';

const HELPFUL_LINKS = [
  { href: '/pages/mattress-store-locations', label: 'All 5 LA showrooms' },
  { href: '/pages/mattress-store-delivery', label: 'Delivery in Los Angeles' },
  { href: '/pages/mattress-store-financing', label: '0% APR financing' },
  { href: '/pages/love-your-bed-guarantee', label: '120-night comfort exchange' },
  { href: '/sleep-quiz', label: 'Take the 2-minute sleep quiz' },
  { href: '/pages/mattress-store-contact', label: 'Ask us a question' },
];

/**
 * Coded /pages/faq page (no Shopify CMS page behind it). Reuses the
 * homepage FAQ accordion markup/classes so no new CSS, grouped into
 * FAQ_PAGE_SECTIONS. FAQPage JSON-LD is emitted by the segment layout
 * (lib/coded-pages.ts), not here.
 */
export async function FaqPage() {
  // Live FAQ — merchant edits Shopify Admin → Content → Metaobjects
  // → FAQ item; ISR picks up within an hour. Falls back to the
  // hardcoded FAQ_PAGE_SECTIONS constant when the live fetch is empty.
  const live = await getFaqItems();
  const sections = resolveFaqPageSections(live);
  return (
    <main className="container" style={{ paddingTop: 'var(--s-7)', paddingBottom: 'var(--s-9)' }}>
      <article className="cms-page">
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span>FAQ</span>
        </nav>

        <header style={{ margin: 'var(--s-4) 0 var(--s-6)' }}>
          <div className="eyebrow">Help center</div>
          <h1 className="h1" style={{ marginTop: 'var(--s-3)' }}>Frequently asked questions</h1>
          <p className="muted" style={{ maxWidth: '60ch', marginTop: 'var(--s-3)' }}>
            Delivery, financing, our price match, the 120-night exchange, and how to
            choose — answered. Still stuck? Call us or visit any of our 5 LA showrooms.
          </p>
        </header>

        {sections.map((section) => (
          <section className="section" key={section.title} style={{ marginTop: 'var(--s-6)' }}>
            <h2 className="h2" style={{ marginBottom: 'var(--s-3)' }}>{section.title}</h2>
            <div className="faq-list">
              {section.items.map((it) => (
                <details key={it.q} className="faq-item">
                  <summary className="faq-q">
                    <span>{it.q}</span>
                    <span className="faq-icon faq-icon-closed"><Icon name="plus" size={18} /></span>
                    <span className="faq-icon faq-icon-open"><Icon name="minus" size={18} /></span>
                  </summary>
                  <div className="faq-a">
                    <p>{renderFaqAnswer(it.a)}</p>
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}

        <section className="section" style={{ marginTop: 'var(--s-7)' }}>
          <div className="eyebrow">Still have questions?</div>
          <h2 className="h2" style={{ margin: 'var(--s-2) 0 var(--s-4)' }}>Talk to a real human.</h2>
          <ul className="showroom-chips" aria-label="Helpful pages">
            {HELPFUL_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="showroom-chip showroom-chip-link">{l.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
