import Link from 'next/link';
import { Icon } from '../icon';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { wrapCmsTables } from '@/lib/cms-html';
import { stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import type { GuidePageConfig } from '@/lib/guide-pages';
import { ServicePageToc } from './service-page-toc';

/**
 * Shared template for the editorial buying-guide pages (mattress sizes,
 * mattress types). Renders the rich merchant-authored CMS body — size
 * chart, per-size / per-type sections, decision lists — inside the same
 * brand-level chrome the service + comparison pages use:
 *
 *   - Breadcrumb
 *   - Hero (eyebrow + h1 + lede + "last updated")
 *   - 3-item trust strip (reuses the .service-page-trust vocabulary)
 *   - Body (merchant HTML) + sticky right-rail TOC on desktop. Any raw
 *     <table> (e.g. the size chart) is wrapped in a horizontal-scroll
 *     container and restyled (sticky header + label column) by the
 *     shared .cmp-table-scroll CSS, plus .guide-body row-header polish.
 *   - End-of-page CTA strip
 *
 * The merchant content stays editable in Shopify Admin; only the chrome
 * lives in code. Per-handle eyebrow / trust / CTA come from GUIDE_PAGES
 * in lib/guide-pages.ts.
 *
 * Why a dedicated template (vs routing through ServicePage): the guide
 * bodies carry tables (ServicePage doesn't run wrapCmsTables) and want a
 * slightly wider measure, so they get their own thin component + a small
 * .guide-body CSS surface while still sharing the service-page chrome.
 */

type PageLike = {
  title: string;
  body: string | null;
  updatedAt: string;
  handle: string;
};

const BODY_ID = 'guide-page-body';

export function GuidePage({
  page,
  config,
}: {
  page: PageLike;
  config: GuidePageConfig;
}) {
  const cleanTitle = toSentenceCase(stripBrandSuffix(page.title));
  const updatedLabel = page.updatedAt
    ? new Date(page.updatedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;
  const bodyHtml = page.body
    ? wrapCmsTables(autoLinkArticleBody(sanitizeShopifyHtml(page.body)))
    : '';

  return (
    <main className="container">
      <article className="service-page guide-page">
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb" style={{ paddingTop: 'var(--s-5)' }}>
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span>{cleanTitle}</span>
        </nav>

        <header className="service-page-hero">
          <div className="eyebrow">{config.eyebrow}</div>
          <h1 className="h1">{cleanTitle}</h1>
          <p className="service-page-lede">{config.lede}</p>
          {updatedLabel ? (
            <p className="service-page-updated muted">
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
            className="rte cms-body guide-body"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>

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
