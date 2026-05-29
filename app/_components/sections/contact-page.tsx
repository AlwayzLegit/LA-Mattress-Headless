import Link from 'next/link';
import { Icon } from '../icon';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { wrapCmsTables } from '@/lib/cms-html';
import { stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY, SITE_EMAIL } from '@/lib/site-config';
import type { ServicePageConfig } from '@/lib/service-pages';
import { ServicePageToc } from './service-page-toc';

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

const CONTACT_ACTIONS: ContactAction[] = [
  {
    icon: 'phone',
    title: 'Call us',
    value: SITE_PHONE_DISPLAY,
    sub: 'Live, 10 AM–8 PM Pacific · daily',
    href: `tel:${SITE_PHONE_TEL}`,
  },
  {
    icon: 'mail',
    title: 'Email us',
    value: SITE_EMAIL,
    sub: 'Reply within one business day',
    href: `mailto:${SITE_EMAIL}`,
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

export function ContactPage({
  page,
  config,
}: {
  page: PageLike;
  config: ServicePageConfig;
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
          {CONTACT_ACTIONS.map((a) => {
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

        {/* All-five-showroom map — same embed the locations index uses.
            Brand query surfaces every GBP-verified pin; no Maps API key
            needed. lazy + fixed height keeps it out of the CLS budget. */}
        <section className="locations-map-wrap" aria-label="All five showroom locations on a map" style={{ marginTop: 'var(--s-6)' }}>
          <iframe
            title="LA Mattress Store — all five showroom locations on Google Maps"
            src="https://www.google.com/maps?q=LA+Mattress+Store+Los+Angeles&z=10&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            style={{ width: '100%', height: 320, border: 0, borderRadius: 'var(--r-3, 12px)' }}
          />
        </section>

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
