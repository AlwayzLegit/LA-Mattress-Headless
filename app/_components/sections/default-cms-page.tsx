import Link from 'next/link';

import type { Page } from '@/lib/shopify/types';
import { stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';
import { Icon } from '@/app/_components/icon';
import { BrandDirectory } from '@/app/_components/sections/brand-directory';

/**
 * Plain-CMS fallback template for /pages/[handle] — used when no
 * specialized template (showroom, locations, sale, neighborhood,
 * service, comparison, guide, legal, …) claims the handle. Extracted
 * from app/(storefront)/pages/[handle]/page.tsx (deep audit
 * codeq-godfile-01) — pure move, no behavior change.
 */

/**
 * Fallback for published pages that have no body content. The previous
 * UX rendered "This page has no content yet" which is bad on real
 * customer-facing URLs. Reuses the 404 page's category grid + secondary
 * link pattern so the visitor lands somewhere useful regardless of which
 * empty handle they hit.
 */
const EMPTY_FALLBACK_CATEGORIES: { label: string; href: string; sub: string }[] = [
  { label: 'Mattresses',       href: '/collections/mattresses',                sub: 'All sizes & brands' },
  { label: 'Tempur-Pedic',     href: '/collections/tempur-pedic-mattresses',   sub: 'Memory foam, premium' },
  { label: 'Stearns & Foster', href: '/collections/stearns-foster-mattresses', sub: 'Luxury hybrids' },
  { label: 'On Sale',          href: '/collections/on-sale',                   sub: 'Current markdowns' },
  { label: 'Showrooms',        href: '/pages/mattress-store-locations',        sub: '5 across LA' },
  { label: 'Sleep Quiz',       href: '/sleep-quiz',                            sub: '8 questions, 2 minutes' },
];

export function DefaultPage({ page }: { page: Page | null }) {
  if (!page) return null;

  // BreadcrumbList + WebPage JSON-LD. The locations index and showroom
  // templates already emit their own structured data; the default
  // template was emitting none, so cms pages had no rich-result eligibility
  // beyond the generic site-wide Organization/WebSite from layout.tsx.
  const cleanTitle = toSentenceCase(stripBrandSuffix(page.title));
  // Optional custom H1 from the `custom.seo_h1` metafield (merchant-editable
  // in Admin); falls back to the case-normalized page title. Shopify source
  // of truth (retired lib/page-seo-overrides.ts).
  const h1 = page.seoH1 ?? cleanTitle;
  // "Last updated" feels like clutter on most marketing copy but it's
  // load-bearing on warranty / policy / returns pages where freshness
  // matters legally and for SEO. Show it on all cms pages — it's a
  // small muted line, hard to perceive as noise. The JSON-LD also gets
  // dateModified + datePublished so crawlers can surface it in rich
  // results (Google's Article + WebPage carousels both use it).
  const updatedLabel = page.updatedAt
    ? new Date(page.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <main className="container">
      <article className="cms-page" style={{ padding: 'var(--s-8) 0' }}>
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span>{toSentenceCase(stripBrandSuffix(page.title))}</span>
        </nav>
        <h1 className="h1" style={{ marginTop: 'var(--s-4)' }}>{h1}</h1>
        {updatedLabel ? (
          <p className="muted" style={{ fontSize: 13, marginTop: 'var(--s-2)' }}>
            <time dateTime={page.updatedAt}>Last updated {updatedLabel}</time>
          </p>
        ) : null}
        {/* Hard-coded on-brand brand directory, rendered ABOVE the
            merchant-authored CMS body for /pages/mattress-brands: the
            scannable logo/link grid (live from getBrands(), so new
            brands like Sleep & Beyond appear automatically) leads, with
            the tiered editorial guide as supporting depth below. */}
        {page.handle === 'mattress-brands' ? <BrandDirectory /> : null}
        {page.body ? (
          <div className="rte cms-body" dangerouslySetInnerHTML={{ __html: autoLinkArticleBody(sanitizeShopifyHtml(page.body)) }} />
        ) : (
          // Fallback for pages that exist + are published but have no
          // body content yet. Reuses the 404 page's category-tile +
          // secondary-link pattern so the visitor lands somewhere
          // useful instead of a "no content yet" dead end. Better SEO
          // signal too — the page now offers actual outbound link
          // value rather than near-zero content.
          <div style={{ marginTop: 'var(--s-5)' }}>
            <p className="muted" style={{ fontSize: 17, lineHeight: 1.5, maxWidth: '52ch', marginBottom: 'var(--s-6)' }}>
              We&rsquo;re still updating this page. In the meantime, here&rsquo;s where most folks were heading next, or call us at{' '}
              <a href={`tel:${SITE_PHONE_TEL}`}>{SITE_PHONE_DISPLAY}</a>.
            </p>
            <div className="nf-grid">
              {EMPTY_FALLBACK_CATEGORIES.map((c) => (
                <Link key={c.href} href={c.href} className="nf-tile">
                  <div className="nf-tile-label">{c.label}</div>
                  <div className="nf-tile-sub muted">{c.sub}</div>
                  <Icon name="arrow-right" size={16} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </main>
  );
}
