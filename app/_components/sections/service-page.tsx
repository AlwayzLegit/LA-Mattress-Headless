import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '../icon';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { wrapCmsTables } from '@/lib/cms-html';
import { stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import type { ServicePageConfig } from '@/lib/service-pages';
import { ServicePageToc } from './service-page-toc';

/**
 * Shared template for the "confidence" pages: financing, warranty,
 * comfort exchange, delivery, and contact. Each renders rich merchant-
 * authored CMS body content inside a brand-level visual chrome:
 *
 *   - Breadcrumb
 *   - Hero (eyebrow + h1 + lede + "last updated")
 *   - 3-item trust strip (per-page icons + copy)
 *   - Body (merchant HTML) + sticky right-rail TOC on desktop
 *   - End-of-page CTA strip (primary + secondary action)
 *
 * The merchant content stays editable in Shopify Admin; only the
 * surrounding chrome lives in code. Page-specific eyebrow / trust /
 * CTA come from SERVICE_PAGES in lib/service-pages.ts.
 *
 * Why a shared template (not 5 custom components): the 5 pages share
 * the same visual vocabulary and we want them to keep matching as the
 * brand evolves. One template ensures any future improvement
 * (e.g. sticky bottom CTA, related-articles strip) lands on all 5.
 */

type PageLike = {
  title: string;
  body: string | null;
  updatedAt: string;
  handle: string;
};

const BODY_ID = 'service-page-body';

export function ServicePage({
  page,
  config,
  extras,
}: {
  page: PageLike;
  config: ServicePageConfig;
  /**
   * Optional code-controlled visual blocks for a specific handle,
   * rendered between the merchant body and the CTA. Used by the
   * financing page (step flow + provider cards); other handles pass
   * nothing and render exactly as before.
   */
  extras?: ReactNode;
}) {
  const cleanTitle = toSentenceCase(stripBrandSuffix(page.title));
  const updatedLabel = page.updatedAt
    ? new Date(page.updatedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <main className="container">
      <article className="service-page">
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
          {/*
            Right-rail TOC injected client-side from the rendered h2s.
            Scrollspy + sticky position. Hidden on tablet/mobile via
            CSS, collapses below the body where a TOC adds no value.
          */}
          <ServicePageToc bodyContainerId={BODY_ID} />
          <div
            id={BODY_ID}
            className="rte cms-body service-page-body"
            dangerouslySetInnerHTML={{
              __html: page.body
                ? wrapCmsTables(autoLinkArticleBody(sanitizeShopifyHtml(page.body)))
                : '',
            }}
          />
        </div>

        {extras}

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
