import Link from 'next/link';
import { Icon } from '../icon';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { wrapCmsTables } from '@/lib/cms-html';
import { stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import { GUIDE_PAGES } from '@/lib/guide-pages';
import { MATTRESS_SIZES, MATTRESS_SIZES_FAQ } from '@/lib/mattress-sizes-data';
import { ServicePageToc } from './service-page-toc';

/**
 * Dedicated template for `/pages/mattress-sizes`.
 *
 * Why a dedicated template (vs the shared GuidePage): Semrush 20260530
 * flagged this URL with 21,599 priority points across 17 distinct
 * target keywords — by far the biggest single-URL concentration in
 * the audit (next-largest is 18,813 on a merchant blog). The keyword
 * variants (`60x80 bed size`, `bed dimensions feet`,
 * `king size measurement mattress`, `size twin bed dimensions`, etc.)
 * are dimension-format and size-comparison phrasings that the
 * merchant body (sized at ~830 words) doesn't fully cover. Rather
 * than ask the merchant to balloon the CMS body, this template adds
 * code-controlled content blocks AFTER the merchant body:
 *
 *   1. Multi-format dimensions reference table — every size in
 *      inches, feet (covers `bed dimensions feet`), centimeters,
 *      with "best for" and minimum-room columns.
 *   2. 14-item FAQ accordion — each Q&A picks up one or more
 *      Semrush-flagged keyword variants in natural form, with a
 *      contextual internal link to the relevant size collection /
 *      sleep quiz / showrooms page.
 *   3. FAQPage JSON-LD — same 14 Q&A in schema.org markup so Google
 *      can promote the answers as a SERP rich snippet (the
 *      `add_aggregate_rating`-equivalent CTR lift but appropriate
 *      to question-and-answer content).
 *
 * Everything else (breadcrumb, hero, trust strip, merchant body
 * with autolinker, TOC, end-CTA) is borrowed from the GuidePage
 * pattern — config still reads from GUIDE_PAGES['mattress-sizes'] so
 * the eyebrow / lede / CTA stay in sync if either guide page evolves.
 *
 * Routing: registered in app/(storefront)/pages/[handle]/page.tsx
 * before the isGuidePage check, so `mattress-sizes` hits this
 * template and `mattress-types` keeps using GuidePage.
 */

type PageLike = {
  title: string;
  body: string | null;
  updatedAt: string;
  handle: string;
};

const BODY_ID = 'guide-page-body';
const FAQ_HEADING_ID = 'mattress-sizes-faq-heading';
const DIMS_HEADING_ID = 'mattress-sizes-dims-heading';
const SITE = 'https://www.mattressstoreslosangeles.com';

export function MattressSizesPage({ page }: { page: PageLike }) {
  const config = GUIDE_PAGES['mattress-sizes'];
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

  // FAQPage JSON-LD — emitted as a sibling <script> so the rendered
  // accordion and the schema markup share the same source-of-truth
  // (lib/mattress-sizes-data.ts). bestRating/worstRating omitted —
  // they don't apply to FAQPage; only AggregateRating uses them.
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: MATTRESS_SIZES_FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        // FAQPage Answer.text accepts HTML but Google's parser
        // collapses everything to plain text for the rich snippet,
        // so emit the link as a trailing sentence rather than embed
        // <a> markup (cleaner SERP truncation).
        text: item.link
          ? `${item.a} See: ${SITE}${item.link.href}`
          : item.a,
      },
    })),
  };

  return (
    <>
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
            <ServicePageToc bodyContainerId={BODY_ID} />
            <div
              id={BODY_ID}
              className="rte cms-body guide-body"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>

          {/* Multi-format dimensions reference. The merchant body's
              size chart lists inches only; this table adds feet (for
              the "bed dimensions feet" Semrush keyword) and
              centimeters (for international shoppers and bedding
              specs). Each size links to its own collection. */}
          <section className="ms-dims" aria-labelledby={DIMS_HEADING_ID}>
            <h2 id={DIMS_HEADING_ID} className="h2 ms-section-h">Mattress dimensions in inches, feet &amp; cm</h2>
            <p className="muted ms-section-lede">
              Every standard US mattress size with its full dimension breakdown — inches (the spec sheet), feet (room planning), and centimeters (international bedding).
            </p>
            <div className="ms-dims-tablewrap">
              <table className="ms-dims-table">
                <caption className="sr-only">Mattress dimensions in inches, feet, and centimeters with sleeper profile and minimum room size</caption>
                <thead>
                  <tr>
                    <th scope="col">Size</th>
                    <th scope="col">Inches (W × L)</th>
                    <th scope="col">Feet (W × L)</th>
                    <th scope="col">Centimeters</th>
                    <th scope="col">Best for</th>
                    <th scope="col">Min. room</th>
                  </tr>
                </thead>
                <tbody>
                  {MATTRESS_SIZES.map((s) => (
                    <tr key={s.name}>
                      <th scope="row" className="ms-dims-name">
                        <Link href={s.collectionHref}>{s.name}</Link>
                      </th>
                      <td className="tnum">{s.inches}</td>
                      <td className="tnum">{s.feet}</td>
                      <td className="tnum">{s.cm}</td>
                      <td>{s.bestFor}</td>
                      <td className="tnum">{s.minRoom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* FAQ accordion. <details>/<summary> for native expand
              behavior + accessibility without client JS. Each answer
              ends with an optional internal link. The same Q&A set
              feeds the FAQPage JSON-LD below. */}
          <section className="ms-faq" aria-labelledby={FAQ_HEADING_ID}>
            <h2 id={FAQ_HEADING_ID} className="h2 ms-section-h">Mattress size FAQs</h2>
            <p className="muted ms-section-lede">
              The 14 questions shoppers ask us most often about bed sizes — answered.
            </p>
            <div className="ms-faq-list">
              {MATTRESS_SIZES_FAQ.map((item) => (
                <details key={item.q} className="ms-faq-item">
                  <summary className="ms-faq-q">{item.q}</summary>
                  <div className="ms-faq-a">
                    <p>
                      {item.a}
                      {item.link ? (
                        <>
                          {' '}
                          <Link href={item.link.href}>{item.link.label}</Link>.
                        </>
                      ) : null}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </section>

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

      <script
        id="ld-faq-mattress-sizes"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
    </>
  );
}
