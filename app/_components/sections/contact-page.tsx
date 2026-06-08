import Link from 'next/link';
import { Icon } from '../icon';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { wrapCmsTables } from '@/lib/cms-html';
import { stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import { resolveSiteConfig } from '@/lib/site-config';
import { getSiteConfig } from '@/lib/shopify';
import type { ServicePageConfig } from '@/lib/service-pages';
import { ServicePageToc } from './service-page-toc';
import { ShowroomsMap } from './showrooms-map';

/**
 * Dedicated template for /pages/mattress-store-contact. The contact page
 * was rendering its rich CMS body (contact-method table, showroom list,
 * FAQ) as a plain wall via the generic ServicePage template. A contact
 * page needs more: tappable contact actions up top and a map.
 *
 * Layout:
 *   - Breadcrumb
 *   - Hero (eyebrow + h1 + lede + "last updated")
 *   - Contact action cards: Call / Email / Visit / Live chat — the #1
 *     thing a contact page needs, rendered as big tappable cards from
 *     site-config constants (not duplicated from the merchant prose).
 *   - All-five-showroom map (reuses the locations-page embed)
 *   - Body (merchant HTML) + sticky right-rail TOC, table restyled
 *   - End-of-page CTA strip
 *
 * Reuses the ServicePageConfig already defined for this handle in
 * lib/service-pages.ts (eyebrow / lede / cta); the trust strip is
 * replaced by the richer contact action cards.
 */

type PageLike = {
  title: string;
  body: string | null;
  updatedAt: string;
  handle: string;
};

const BODY_ID = 'contact-page-body';

type ContactAction = {
  icon: 'phone' | 'mail' | 'pin' | 'chat';
  title: string;
  value: string;
  sub: string;
  href?: string;
};

export async function ContactPage({
  page,
  config,
}: {
  page: PageLike;
  config: ServicePageConfig;
}) {
  // Live phone / email — merchant edits the `site_config` metaobject in
  // Shopify Admin and these cards reflect within one ISR cycle.
  // `getSiteConfig()` is React.cache()-memoized so the storefront
  // layout's call (for Organization JSON-LD) and this call share a
  // single Storefront request per render.
  const siteConfig = resolveSiteConfig(await getSiteConfig());
  const contactActions: ContactAction[] = [
    {
      icon: 'phone',
      title: 'Call us',
      value: siteConfig.phoneDisplay,
      sub: 'Live, 10 AM–8 PM Pacific · daily',
      href: `tel:${siteConfig.phoneTel}`,
    },
    {
      icon: 'mail',
      title: 'Email us',
      value: siteConfig.email,
      sub: 'Reply within one business day',
      href: `mailto:${siteConfig.email}`,
    },
    {
      icon: 'pin',
      title: 'Visit a showroom',
      value: '5 LA locations',
      sub: 'Walk in — no appointment needed',
      href: '/pages/mattress-store-locations',
    },
    {
      icon: 'chat',
      title: 'Live chat',
      value: 'Chat icon, lower-right',
      sub: 'A real consultant replies in ~1 min',
    },
  ];

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
      <article className="service-page contact-page">
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

        {/* Contact action cards — the primary call-to-action. Real links
            (tel / mailto / showrooms); the chat card points to the global
            widget. Replaces the generic trust strip for this page. */}
        <section className="contact-actions" aria-label="Ways to reach us">
          {contactActions.map((a) => {
            const inner = (
              <>
                <span className="contact-action-icon" aria-hidden="true">
                  <Icon name={a.icon} size={20} />
                </span>
                <span className="contact-action-title">{a.title}</span>
                <span className="contact-action-value">{a.value}</span>
                <span className="contact-action-sub">{a.sub}</span>
              </>
            );
            if (!a.href) {
              return (
                <div key={a.title} className="contact-action contact-action-static">
                  {inner}
                </div>
              );
            }
            return a.href.startsWith('/') ? (
              <Link key={a.title} href={a.href} className="contact-action">
                {inner}
              </Link>
            ) : (
              <a key={a.title} href={a.href} className="contact-action">
                {inner}
              </a>
            );
          })}
        </section>

        {/* All-five-showroom map — custom static map (only our pins, no
            competitors, no third-party request). Same component the
            locations index uses. */}
        <div style={{ marginTop: 'var(--s-6)' }}>
          <ShowroomsMap />
        </div>

        <div className="service-page-layout" style={{ marginTop: 'var(--s-7)' }}>
          <ServicePageToc bodyContainerId={BODY_ID} />
          <div
            id={BODY_ID}
            className="rte cms-body contact-body"
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
