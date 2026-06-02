import Link from 'next/link';
import { Icon } from '../icon';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { wrapCmsTables } from '@/lib/cms-html';
import { stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import type { ComparisonPageConfig, ComparisonPageHandle } from '@/lib/comparison-pages';
import { COMPARISON_EXTRAS } from '@/lib/comparison-extras-data';
import { ServicePageToc } from './service-page-toc';

/**
 * Shared template for editorial "X vs Y" comparison pages (brand-vs-
 * brand, retailer-vs-retailer). Renders the rich merchant-authored CMS
 * body — verdict, side-by-side table, category breakdowns, FAQ — inside
 * a brand-level visual chrome:
 *
 *   - Breadcrumb
 *   - "VS" hero: eyebrow + two name plates split by a VS badge + h1 +
 *     lede + "last updated"
 *   - 3-item trust strip (reuses the .service-page-trust vocabulary)
 *   - Body (merchant HTML) + sticky right-rail TOC on desktop. The raw
 *     comparison <table> is wrapped in a horizontal-scroll container and
 *     restyled (sticky label column, zebra rows) by .comparison-body CSS.
 *   - End-of-page CTA strip
 *
 * The merchant content stays editable in Shopify Admin; only the chrome
 * lives in code. Per-handle hero plates / trust / CTA come from
 * COMPARISON_PAGES in lib/comparison-pages.ts.
 *
 * Why a shared template (not one component per comparison): the pages
 * share the same visual vocabulary and should keep matching as more
 * "vs" pages are added — one template, one CSS surface.
 */

type PageLike = {
  title: string;
  body: string | null;
  updatedAt: string;
  handle: string;
};

const BODY_ID = 'comparison-page-body';

export function ComparisonPage({
  page,
  config,
}: {
  page: PageLike;
  config: ComparisonPageConfig;
}) {
  const cleanTitle = toSentenceCase(stripBrandSuffix(page.title));
  const updatedLabel = page.updatedAt
    ? new Date(page.updatedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;
  const [left, right] = config.sides;
  const bodyHtml = page.body
    ? wrapCmsTables(autoLinkArticleBody(sanitizeShopifyHtml(page.body)))
    : '';
  // Code-controlled visual blocks (decision cards + feel ratings),
  // sourced from the merchant's own published copy. See
  // lib/comparison-extras-data.ts.
  const extras = COMPARISON_EXTRAS[page.handle as ComparisonPageHandle];

  return (
    <main className="container">
      <article className="service-page comparison-page">
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb" style={{ paddingTop: 'var(--s-5)' }}>
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span>{cleanTitle}</span>
        </nav>

        <header className="comparison-hero">
          <div className="eyebrow">{config.eyebrow}</div>

          {/* Two contender plates split by a centered VS badge. Stacks
              vertically on narrow viewports (VS badge in the middle). */}
          <div className="comparison-vs" aria-hidden="true">
            <div className="comparison-side">
              <span className="comparison-side-name">{left.name}</span>
              <span className="comparison-side-tag">{left.tagline}</span>
            </div>
            <span className="comparison-vs-badge">vs</span>
            <div className="comparison-side">
              <span className="comparison-side-name">{right.name}</span>
              <span className="comparison-side-tag">{right.tagline}</span>
            </div>
          </div>

          <h1 className="h1">{cleanTitle}</h1>
          <p className="comparison-lede">{config.lede}</p>
          {updatedLabel ? (
            <p className="comparison-updated muted">
              <time dateTime={page.updatedAt}>Last updated {updatedLabel}</time>
            </p>
          ) : null}
        </header>

        <section className="service-page-trust" aria-label="What you can count on">
          {config.trust.map((t, i) => (
            <div key={i} className="service-page-trust-item">
              <span className="service-page-trust-icon" aria-hidden="true">
                <Icon name={t.icon} size={20} />
              </span>
              <div>
                <p className="service-page-trust-title">{t.title}</p>
                <p className="service-page-trust-sub">{t.sub}</p>
              </div>
            </div>
          ))}
        </section>

        <div className="service-page-layout">
          {/* Right-rail TOC injected client-side from the rendered h2s.
              Hidden on tablet/mobile via CSS. */}
          <ServicePageToc bodyContainerId={BODY_ID} />
          <div
            id={BODY_ID}
            className="rte cms-body comparison-body"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>

        {extras ? (
          <>
            <section className="cmpx-decide" aria-labelledby="cmpx-decide-h">
              <h2 id="cmpx-decide-h" className="h2 mt-section-h">{extras.decideHeading}</h2>
              <p className="muted mt-section-lede">
                The short version — match yourself to the column that sounds like you. Still torn? Try both at any of our showrooms.
              </p>
              <div className="cmpx-decide-grid">
                {extras.decide.map((card) => (
                  <article key={card.name} className="cmpx-decide-card">
                    <h3 className="h3 cmpx-decide-name">{card.name}</h3>
                    <p className="cmpx-decide-when">{card.whenLabel}</p>
                    <ul className="cmpx-decide-points">
                      {card.points.map((pt) => (
                        <li key={pt}>
                          <Icon name="check" size={15} aria-hidden="true" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            {extras.feel ? (
              <section className="cmpx-feel" aria-labelledby="cmpx-feel-h">
                <h2 id="cmpx-feel-h" className="h2 mt-section-h">{extras.feel.heading}</h2>
                <p className="muted mt-section-lede">{extras.feel.note}</p>
                <div className="cmpx-feel-table">
                  <div className="cmpx-feel-row cmpx-feel-head" aria-hidden="true">
                    <span className="cmpx-feel-side">{left.name}</span>
                    <span className="cmpx-feel-axis" />
                    <span className="cmpx-feel-side cmpx-feel-side-r">{right.name}</span>
                  </div>
                  {extras.feel.axes.map((axis) => (
                    <div key={axis.label} className="cmpx-feel-row">
                      <span className="mt-pips cmpx-feel-pips-l" role="img" aria-label={`${left.name} ${axis.label}: ${axis.left} of 5`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={`mt-pip${n <= axis.left ? ' is-on' : ''}`} aria-hidden="true" />
                        ))}
                      </span>
                      <span className="cmpx-feel-axis">{axis.label}</span>
                      <span className="mt-pips cmpx-feel-pips-r" role="img" aria-label={`${right.name} ${axis.label}: ${axis.right} of 5`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={`mt-pip${n <= axis.right ? ' is-on' : ''}`} aria-hidden="true" />
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        <section className="service-page-cta" aria-label="Next steps">
          <p className="service-page-cta-headline">{config.cta.headline}</p>
          <div className="service-page-cta-actions">
            <Link href={config.cta.primary.href} className="btn btn-primary">
              {config.cta.primary.label}
            </Link>
            {config.cta.secondary ? (
              config.cta.secondary.href.startsWith('tel:') ? (
                <a href={config.cta.secondary.href} className="btn btn-ghost">
                  {config.cta.secondary.label}
                </a>
              ) : (
                <Link href={config.cta.secondary.href} className="btn btn-ghost">
                  {config.cta.secondary.label}
                </Link>
              )
            ) : null}
          </div>
        </section>
      </article>
    </main>
  );
}
