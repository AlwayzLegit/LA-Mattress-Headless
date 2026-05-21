import type { Product } from '@/lib/shopify';
import { Icon, type IconName } from '@/app/_components/icon';

/**
 * PDP Overview section — design handoff §Overview.
 *
 * Renders ONLY when at least one of:
 *   - lede, bestFor[], notIdealFor[], highlights[]
 * is populated. If the merchant hasn't filled in any editorial
 * metafields the section returns null — the page stays clean during
 * onboarding.
 *
 * Layout:
 *   .pdp-overview-body  grid 1.4fr / 1fr
 *     .pdp-overview-prose       lede + paragraphs + .pdp-overview-fits (Best for / Not ideal for)
 *     .pdp-overview-highlights  2-col grid of icon + title + body cards
 */
export function PdpOverview({ product }: { product: Product }) {
  const { editorial } = product;
  const hasOverview =
    editorial.lede ||
    editorial.bestFor.length > 0 ||
    editorial.notIdealFor.length > 0 ||
    editorial.highlights.length > 0;

  if (!hasOverview) return null;

  const tagline = editorial.tagline ?? null;

  return (
    <section className="pdp-section pdp-overview">
      <div className="pdp-section-head">
        <div>
          <div className="eyebrow">Overview</div>
          <h2 className="h2">{tagline ?? 'About this mattress'}</h2>
        </div>
        {editorial.lede ? (
          <p className="muted pdp-section-lede">{editorial.lede}</p>
        ) : null}
      </div>

      <div className="pdp-overview-body">
        <div className="pdp-overview-prose">
          {(editorial.bestFor.length > 0 || editorial.notIdealFor.length > 0) ? (
            <div className="pdp-overview-fits">
              {editorial.bestFor.length > 0 ? (
                <div className="pdp-overview-fit">
                  <div className="pdp-overview-fit-head">
                    <Icon name="check" size={16} />
                    <span className="mono">Best for</span>
                  </div>
                  <ul className="pdp-overview-fit-list">
                    {editorial.bestFor.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                </div>
              ) : null}
              {editorial.notIdealFor.length > 0 ? (
                <div className="pdp-overview-fit pdp-overview-fit-not">
                  <div className="pdp-overview-fit-head">
                    <Icon name="close" size={16} />
                    <span className="mono">Not ideal for</span>
                  </div>
                  <ul className="pdp-overview-fit-list">
                    {editorial.notIdealFor.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {editorial.highlights.length > 0 ? (
          <div className="pdp-overview-highlights">
            {editorial.highlights.map((h) => (
              <div key={h.title} className="pdp-overview-highlight">
                <div className="pdp-overview-highlight-icon">
                  <Icon name={h.icon as IconName} size={20} />
                </div>
                <div className="pdp-overview-highlight-title">{h.title}</div>
                <p className="pdp-overview-highlight-body">{h.body}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
