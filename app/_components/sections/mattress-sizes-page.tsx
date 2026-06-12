import type { ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '../icon';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { wrapCmsTables } from '@/lib/cms-html';
import { stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import { GUIDE_PAGES } from '@/lib/guide-pages';
import { MATTRESS_SIZES, MATTRESS_SIZES_FAQ, MATTRESS_SIZES_RELATED_GUIDES, SPECIALTY_SIZES, type MattressSize } from '@/lib/mattress-sizes-data';
import { ServicePageToc } from './service-page-toc';

// ── To-scale bed glyph ───────────────────────────────────────────
// Every bed is drawn at the same px-per-inch scale so the diagrams are
// directly comparable (a King is visibly bigger than a Twin), with
// sleeper silhouettes conveying solo vs. couple capacity — the
// signature graphic every competitor "mattress sizes" page leads with.
const BED_SCALE = 1.7; // px per inch
const BED_PAD = 6;

function sleeperGlyph(ax: number, ay: number, aw: number, ah: number, key: string) {
  const headR = Math.max(4, aw * 0.22);
  const headCy = ay + headR + ah * 0.03;
  const bodyW = aw * 0.52;
  const bodyTop = headCy + headR * 0.55;
  const bodyH = Math.max(8, ay + ah - bodyTop);
  return (
    <g key={key} fill="#1B2C5E" opacity={0.5}>
      <circle cx={ax + aw / 2} cy={headCy} r={headR} />
      <rect x={ax + aw / 2 - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} rx={bodyW / 2} />
    </g>
  );
}

function BedSvg({ size }: { size: MattressSize }) {
  const pxW = size.wIn * BED_SCALE + BED_PAD * 2;
  const pxH = size.lIn * BED_SCALE + BED_PAD * 2;
  const matX = BED_PAD;
  const matY = BED_PAD;
  const matW = pxW - BED_PAD * 2;
  const matH = pxH - BED_PAD * 2;
  const insetX = matW * 0.1;
  const insetY = matH * 0.07;
  const areaX = matX + insetX;
  const areaY = matY + insetY;
  const areaW = matW - insetX * 2;
  const areaH = matH - insetY * 2;
  const sleepers: ReactNode[] =
    size.sleepers === 1
      ? [sleeperGlyph(areaX + areaW * 0.25, areaY, areaW * 0.5, areaH, 's1')]
      : [
          sleeperGlyph(areaX, areaY, areaW * 0.46, areaH, 's1'),
          sleeperGlyph(areaX + areaW * 0.54, areaY, areaW * 0.46, areaH, 's2'),
        ];
  return (
    <svg
      className="sz-bed"
      width={pxW}
      height={pxH}
      viewBox={`0 0 ${pxW} ${pxH}`}
      role="img"
      aria-label={`${size.name}, ${size.inches}, sleeps ${size.sleepers === 2 ? 'two' : 'one'}`}
    >
      <rect x={matX} y={matY} width={matW} height={matH} rx={11} fill="#EFF3FA" stroke="#1B2C5E" strokeWidth={2} />
      {size.name === 'Split King' ? (
        <line
          x1={pxW / 2}
          y1={matY}
          x2={pxW / 2}
          y2={matY + matH}
          stroke="#1B2C5E"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          opacity={0.55}
        />
      ) : null}
      {sleepers}
    </svg>
  );
}

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
const GUIDES_HEADING_ID = 'mattress-sizes-guides-heading';
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

          {/* To-scale comparison — the lead graphic. All seven sizes
              drawn at one px-per-inch scale, bottom-aligned, so the
              relative footprints are obvious at a glance. */}
          <section className="sz-scale" aria-labelledby="sizes-scale-heading">
            <h2 id="sizes-scale-heading" className="h2 ms-section-h">Every mattress size to scale</h2>
            <p className="muted ms-section-lede">
              All seven standard sizes drawn to the same scale, narrowest to widest — so you can see exactly how much bed each one gives you, and whether it sleeps one or two.
            </p>
            <div className="sz-lineup-scroll">
              <div className="sz-lineup">
                {MATTRESS_SIZES.map((s) => (
                  <Link key={s.name} href={s.collectionHref} className="sz-lineup-item">
                    <BedSvg size={s} />
                    <span className="sz-lineup-cap">
                      <strong>{s.name}</strong>
                      <span className="muted">{s.inches}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Per-size visual cards — a scaled bed icon with sleeper
              silhouettes plus the at-a-glance specs and a shop link. */}
          <section className="sz-cards-sec" aria-labelledby="sizes-cards-heading">
            <h2 id="sizes-cards-heading" className="h2 ms-section-h">Compare every size</h2>
            <p className="muted ms-section-lede">
              Who each size suits, the smallest bedroom it works in, and what we stock — tap any size to shop it.
            </p>
            <div className="sz-grid">
              {MATTRESS_SIZES.map((s) => (
                <article key={s.name} className="sz-card">
                  <div className="sz-card-figure">
                    <BedSvg size={s} />
                  </div>
                  <div className="sz-card-body">
                    <div className="sz-card-head">
                      <h3 className="h3 sz-card-name">{s.name}</h3>
                      <span className="sz-card-dim">{s.inches}</span>
                    </div>
                    <dl className="sz-specs">
                      <div className="sz-spec">
                        <dt>Best for</dt>
                        <dd>{s.bestFor}</dd>
                      </div>
                      <div className="sz-spec">
                        <dt>Sleeps</dt>
                        <dd>{s.sleepers === 2 ? 'Two' : 'One'}</dd>
                      </div>
                      <div className="sz-spec">
                        <dt>Min. room</dt>
                        <dd>{s.minRoom}</dd>
                      </div>
                    </dl>
                    <Link href={s.collectionHref} className="mt-shop link-arrow">
                      Shop {s.name} mattresses <Icon name="arrow-right" size={14} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
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

          {/* Specialty / RV / camper sizes. SEMrush 20260612 ideas:
              the sizes hub ranked for "camper mattress", "measure your
              rv", "60 x 75", and "custom size" queries it never
              answered — shoppers landed on standard-size content and
              bounced. Non-standard dimensions live in their own table
              (separate SPECIALTY_SIZES list) so the to-scale diagram
              and standard tables stay clean. */}
          <section className="ms-dims" aria-labelledby="specialty-sizes-heading">
            <h2 id="specialty-sizes-heading" className="h2 ms-section-h">Specialty, RV &amp; camper sizes</h2>
            <p className="muted ms-section-lede">
              RVs, campers, antique frames, and odd rooms use non-standard dimensions. RV specs vary by
              manufacturer — measure your RV&rsquo;s platform (width, length, and corner cuts) before buying,
              and ask any showroom about custom size options.
            </p>
            <div className="ms-dims-tablewrap">
              <table className="ms-dims-table">
                <caption className="sr-only">Specialty and RV mattress dimensions in inches</caption>
                <thead>
                  <tr>
                    <th scope="col">Size</th>
                    <th scope="col">Inches (W × L)</th>
                    <th scope="col">Typically used in</th>
                  </tr>
                </thead>
                <tbody>
                  {SPECIALTY_SIZES.map((s) => (
                    <tr key={s.name}>
                      <th scope="row" className="ms-dims-name">{s.name}</th>
                      <td className="tnum">{s.inches}</td>
                      <td>
                        {s.usedIn}
                        {s.guideHref ? (
                          <>
                            {' — '}
                            <Link href={s.guideHref}>{s.guideLabel ?? 'guide'}</Link>
                          </>
                        ) : null}
                      </td>
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

          {/* Related guides. Curated cross-links to the merchant blog
              cluster — closes the loop so link equity flows from the hub
              back to the 20 refreshed size/comparison articles, and so
              crawlers can discover the full cluster from /pages/mattress-sizes.
              Grouped By size / Comparisons / Practical so it scans cleanly
              and helps shoppers self-navigate to the right deep-dive. */}
          <section className="ms-guides" aria-labelledby={GUIDES_HEADING_ID}>
            <h2 id={GUIDES_HEADING_ID} className="h2 ms-section-h">Related size guides</h2>
            <p className="muted ms-section-lede">
              Deeper dives on every standard mattress size, head-to-head comparison, and room-layout question.
            </p>
            <div className="ms-guides-groups">
              {MATTRESS_SIZES_RELATED_GUIDES.map((group) => (
                <div key={group.heading} className="ms-guides-group">
                  <h3 className="ms-guides-group-h">{group.heading}</h3>
                  <ul className="ms-guides-items">
                    {group.guides.map((g) => (
                      <li key={g.href}>
                        <Link href={g.href}>{g.title}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
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
