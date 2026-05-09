import Link from 'next/link';
import { Icon } from '../icon';
import { HOMEPAGE_FAQ } from '@/lib/faq';

/**
 * Homepage FAQ — server component using native <details>/<summary>.
 *
 * Native disclosure semantics give us:
 *   - aria-expanded on the summary, derived from the open attribute,
 *     handled by the browser (no useState, no useId).
 *   - hidden-when-collapsed: built into <details>; collapsed panel
 *     is removed from the layout AND accessibility tree (same SR
 *     correctness Phase 144 added via the `hidden` attribute).
 *   - Native focus-visible on the summary with no ring shimming.
 *
 * Trade-off vs the Phase 144 button-based version: native <details>
 * lets multiple panels stay open simultaneously, where the previous
 * version was exclusive (one-open-at-a-time). The previous behavior
 * was a UX choice but not a requirement — allowing multiple-open is
 * arguably better when the visitor wants to skim a few answers.
 *
 * Visual: the +/- icon swap uses two stacked Icon SVGs, hidden via
 * the .faq-item[open] / :not([open]) selectors in globals.css. No
 * JS, no client component, no hydration cost on this section.
 */
export function FAQ() {
  return (
    <section className="section faq">
      <div className="container faq-inner">
        <div className="faq-head">
          <div className="eyebrow">FAQ</div>
          <h2 className="h2">Questions, answered.</h2>
          <Link href="/pages/mattress-store-contact" className="link-arrow">
            Ask a question <Icon name="arrow-right" size={14} />
          </Link>
        </div>
        <div className="faq-list">
          {HOMEPAGE_FAQ.map((it, i) => (
            // Open first item by default (matches the previous
            // useState(0) initial state).
            <details key={i} className="faq-item" open={i === 0}>
              <summary className="faq-q">
                <span>{it.q}</span>
                <span className="faq-icon faq-icon-closed"><Icon name="plus" size={18} /></span>
                <span className="faq-icon faq-icon-open"><Icon name="minus" size={18} /></span>
              </summary>
              <div className="faq-a">
                <p>{it.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
