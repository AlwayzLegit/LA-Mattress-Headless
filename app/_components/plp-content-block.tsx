import Link from 'next/link';
import { Icon } from './icon';
import { categoryIntroFor, categoryFaqFor } from '@/lib/plp-content';
import { renderFaqAnswer } from '@/lib/faq-render';

/**
 * Below-the-product-grid content block on every /collections/[handle].
 *
 * Phase 265: addresses the May SEMrush audit's 941 "Low text-to-HTML
 * ratio" flags. Three pieces:
 *
 *   1. Category-aware intro paragraph (varies by collection handle so
 *      different PLPs carry different copy — not pure boilerplate).
 *   2. FAQ accordion (6 mattress-shopping questions, distinct from
 *      lib/faq.ts HOMEPAGE_FAQ to avoid duplicate-content overlap).
 *   3. Internal-link cluster to /pages/* policy pages and /sleep-quiz.
 *
 * Also emits FAQPage JSON-LD so the FAQ becomes eligible for Google's
 * rich-result featured-snippet treatment on category searches.
 *
 * Server-rendered. The `<details>` accordion uses native browser open/
 * close (no JS needed). Rendered inside the collection page's <main>.
 */
export function PlpContentBlock({
  handle,
  title,
}: {
  handle: string;
  title: string;
}) {
  const intro = categoryIntroFor(handle, title);
  // Phase 276: per-category FAQ so each PLP has unique Q&A relevant to
  // its material/brand instead of the prior shared PLP_FAQ block.
  const faqItems = categoryFaqFor(handle);
  return (
    <section className="plp-content" aria-labelledby={`plp-content-h-${handle}`}>
      <div className="plp-content-intro">
        <h2 id={`plp-content-h-${handle}`} className="h2 plp-content-title">
          About {title.toLowerCase()} at LA Mattress
        </h2>
        <p className="plp-content-lede">{intro}</p>
      </div>

      <div className="plp-content-grid">
        <div className="plp-content-faq">
          <h3 className="eyebrow plp-content-eyebrow">Common questions</h3>
          {faqItems.map((item) => (
            <details key={item.q} className="plp-content-faq-item">
              <summary>
                <span className="plp-content-faq-q">{item.q}</span>
                <Icon name="chevron-down" size={14} aria-hidden />
              </summary>
              <p className="plp-content-faq-a">{renderFaqAnswer(item.a)}</p>
            </details>
          ))}
        </div>

        <aside className="plp-content-links">
          <h3 className="eyebrow plp-content-eyebrow">Helpful pages</h3>
          <ul className="plp-content-link-list">
            <li><Link href="/sleep-quiz" className="link-arrow">Take the 2-minute sleep quiz <Icon name="arrow-right" size={14} /></Link></li>
            <li><Link href="/pages/mattress-store-locations" className="link-arrow">All 5 LA showrooms <Icon name="arrow-right" size={14} /></Link></li>
            <li><Link href="/pages/mattress-store-delivery" className="link-arrow">Delivery in Los Angeles <Icon name="arrow-right" size={14} /></Link></li>
            <li><Link href="/pages/mattress-store-financing" className="link-arrow">0% APR financing <Icon name="arrow-right" size={14} /></Link></li>
            <li><Link href="/pages/love-your-bed-guarantee" className="link-arrow">120-night exchange <Icon name="arrow-right" size={14} /></Link></li>
            <li><Link href="/pages/mattress-sizes" className="link-arrow">Mattress sizes guide <Icon name="arrow-right" size={14} /></Link></li>
            <li><Link href="/pages/mattress-types" className="link-arrow">Mattress types compared <Icon name="arrow-right" size={14} /></Link></li>
            <li><Link href="/pages/mattress-brands" className="link-arrow">Brands we carry <Icon name="arrow-right" size={14} /></Link></li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
