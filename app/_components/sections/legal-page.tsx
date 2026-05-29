import Link from 'next/link';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { wrapCmsTables } from '@/lib/cms-html';
import { stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';
import type { LegalPageConfig } from '@/lib/legal-pages';
import { ServicePageToc } from './service-page-toc';

/**
 * Shared template for the policy / legal pages (terms, privacy, returns,
 * the policy hub, recycling fee). Renders the long merchant-authored CMS
 * body inside a clean, readable chrome:
 *
 *   - Breadcrumb
 *   - Hero (eyebrow + h1 + "last updated")
 *   - Body (merchant HTML) + sticky right-rail TOC on desktop. A narrower
 *     measure + section dividers keep long legal text readable; any raw
 *     <table> (e.g. the recycling-fee schedule) is wrapped for the shared
 *     .cmp-table-scroll card treatment.
 *   - Slim "questions about a policy?" contact footnote
 *
 * Deliberately NO marketing trust strip or CTA — wrong tone for legal
 * pages. The merchant content stays editable in Shopify Admin; only the
 * chrome lives in code. Per-handle eyebrow comes from LEGAL_PAGES in
 * lib/legal-pages.ts.
 */

type PageLike = {
  title: string;
  body: string | null;
  updatedAt: string;
  handle: string;
};

const BODY_ID = 'legal-page-body';

export function LegalPage({
  page,
  config,
}: {
  page: PageLike;
  config: LegalPageConfig;
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
      <article className="service-page legal-page">
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb" style={{ paddingTop: 'var(--s-5)' }}>
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span>{cleanTitle}</span>
        </nav>

        <header className="service-page-hero legal-hero">
          <div className="eyebrow">{config.eyebrow}</div>
          <h1 className="h1">{cleanTitle}</h1>
          {updatedLabel ? (
            <p className="service-page-updated muted">
              <time dateTime={page.updatedAt}>Last updated {updatedLabel}</time>
            </p>
          ) : null}
        </header>

        <div className="service-page-layout">
          {/* Right-rail TOC injected client-side from the rendered h2s.
              Hidden on tablet/mobile via CSS. */}
          <ServicePageToc bodyContainerId={BODY_ID} />
          <div
            id={BODY_ID}
            className="rte cms-body legal-body"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>

        <aside className="legal-footnote" aria-label="Questions about this policy">
          <p>
            Questions about this policy? Call us at{' '}
            <a href={`tel:${SITE_PHONE_TEL}`}>{SITE_PHONE_DISPLAY}</a> or{' '}
            <Link href="/pages/mattress-store-contact">contact a showroom</Link> — every call
            reaches a real person at a real store.
          </p>
        </aside>
      </article>
    </main>
  );
}
