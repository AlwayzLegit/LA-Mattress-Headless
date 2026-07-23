import type { ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '../icon';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { wrapCmsTables } from '@/lib/cms-html';
import { stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import { GUIDE_PAGES } from '@/lib/guide-pages';
import {
  MATTRESS_TYPES,
  FEEL_AXES,
  type MattressType,
  type ConstructionLayer,
} from '@/lib/mattress-types-data';
import { ServicePageToc } from './service-page-toc';

/**
 * Dedicated template for `/pages/mattress-types`.
 *
 * Why a dedicated template (vs the shared GuidePage): the merchant
 * body is strong editorial prose but the live page carried just two
 * images — a poor text-to-image ratio that reads as a wall of text
 * next to competitor "mattress types" pages (Saatva, Helix, Mattress
 * Firm), which all lead with a layered construction cutaway diagram
 * and an at-a-glance feel visual per type.
 *
 * This template keeps the merchant body as the editorial source of
 * truth (rendered first, with the autolinker + TOC, exactly like
 * GuidePage) and adds three code-controlled VISUAL blocks below it:
 *
 *   1. "The four types at a glance" — one card per type with an inline
 *      SVG construction cross-section (foam bands + drawn coil
 *      springs), a six-axis feel-rating visual, who-it-fits pills, a
 *      price tier, the honest trade-off, and a link to the type's
 *      collection.
 *   2. "Feel comparison at a glance" — a rating-dot matrix comparing
 *      all four types across the six axes in one scannable grid.
 *   3. End CTA (shared service-page chrome).
 *
 * All graphics are inline SVG / CSS — no external image assets, crisp
 * at any DPI, negligible added page weight. Data lives in
 * lib/mattress-types-data.ts so the visuals and the showroom team's
 * feel guidance stay in sync.
 *
 * Routing: registered in app/(storefront)/pages/[handle]/page.tsx
 * before the isGuidePage check, mirroring mattress-sizes.
 */

type PageLike = {
  title: string;
  body: string | null;
  updatedAt: string;
  handle: string;
};

const BODY_ID = 'guide-page-body';
const GLANCE_HEADING_ID = 'mattress-types-glance-heading';
const MATRIX_HEADING_ID = 'mattress-types-matrix-heading';

// ── Inline SVG construction cutaway ──────────────────────────────
// Draws a top-to-bottom cross-section of the mattress. Foam/latex/
// cover/base layers render as solid colour bands; coil layers render
// as a tinted band with drawn springs (stacked ellipses = the classic
// bedspring side profile) so the diagram reads as construction, not a
// flat colour chart.

const SVG_W = 240;
const SVG_H = 168;
const PAD_X = 12;
const PAD_TOP = 8;
const SLAB_W = SVG_W - PAD_X * 2;
const SLAB_H = SVG_H - PAD_TOP * 2;
const RADIUS = 14;

function coilSprings(bandX: number, bandY: number, bandW: number, bandH: number, key: string) {
  const inset = 7;
  const top = bandY + inset;
  const bottom = bandY + bandH - inset;
  const cols = Math.max(5, Math.round(bandW / 28));
  const colGap = bandW / cols;
  const rx = Math.min(colGap * 0.34, 11);
  const rings = 4;
  const ringGap = (bottom - top) / (rings - 1);
  const els: ReactNode[] = [];
  for (let c = 0; c < cols; c++) {
    const cx = bandX + colGap * (c + 0.5);
    for (let r = 0; r < rings; r++) {
      els.push(
        <ellipse
          key={`${key}-${c}-${r}`}
          cx={cx}
          cy={top + ringGap * r}
          rx={rx}
          ry={rx * 0.5}
          fill="none"
          stroke="#5E73A6"
          strokeWidth={1.4}
        />,
      );
    }
  }
  return els;
}

function MattressCutaway({ type }: { type: MattressType }) {
  const totalUnits = type.layers.reduce((sum, l) => sum + l.units, 0);
  const clipId = `mt-clip-${type.slug}`;
  let cursor = PAD_TOP;
  const bands: ReactNode[] = [];
  const springs: ReactNode[] = [];
  const dividers: ReactNode[] = [];

  type.layers.forEach((layer: ConstructionLayer, i) => {
    const h = (layer.units / totalUnits) * SLAB_H;
    const y = cursor;
    bands.push(
      <rect key={`band-${i}`} x={PAD_X} y={y} width={SLAB_W} height={h + 0.5} fill={layer.fill} />,
    );
    if (layer.kind === 'coil') {
      springs.push(...coilSprings(PAD_X, y, SLAB_W, h, `${type.slug}-${i}`));
    }
    if (i > 0) {
      dividers.push(
        <line key={`div-${i}`} x1={PAD_X} y1={y} x2={PAD_X + SLAB_W} y2={y} stroke="rgba(27,44,94,0.12)" strokeWidth={1} />,
      );
    }
    cursor += h;
  });

  const layerNames = type.layers.map((l) => l.label).join(', ');

  return (
    <svg
      className="mt-cutaway"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      role="img"
      aria-label={`${type.name} construction, top to bottom: ${layerNames}.`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={PAD_X} y={PAD_TOP} width={SLAB_W} height={SLAB_H} rx={RADIUS} ry={RADIUS} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {bands}
        {springs}
        {dividers}
      </g>
      <rect
        x={PAD_X}
        y={PAD_TOP}
        width={SLAB_W}
        height={SLAB_H}
        rx={RADIUS}
        ry={RADIUS}
        fill="none"
        stroke="#1B2C5E"
        strokeWidth={2}
      />
    </svg>
  );
}

// ── Rating visuals ───────────────────────────────────────────────

function RatingBar({ value, label }: { value: number; label: string }) {
  return (
    <span className="mt-pips" role="img" aria-label={`${label}: ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`mt-pip${n <= value ? ' is-on' : ''}`} aria-hidden="true" />
      ))}
    </span>
  );
}

function RatingDots({ value, label }: { value: number; label: string }) {
  return (
    <span className="mt-dots" role="img" aria-label={`${label}: ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`mt-dot${n <= value ? ' is-on' : ''}`} aria-hidden="true" />
      ))}
    </span>
  );
}

export function MattressTypesPage({ page }: { page: PageLike }) {
  const config = GUIDE_PAGES['mattress-types'];
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

          {/* Visual type cards, the lead graphic. Placed ABOVE the
              merchant body so the page opens on imagery (cutaway
              diagrams + feel visuals) rather than a wall of prose,
              then the editorial body goes deeper below. */}
          <section className="mt-glance" aria-labelledby={GLANCE_HEADING_ID}>
            <h2 id={GLANCE_HEADING_ID} className="h2 mt-section-h">The four mattress types at a glance</h2>
            <p className="muted mt-section-lede">
              How each construction is built, how it feels across the six things shoppers compare most, and who it suits. Tap any type to see what we stock.
            </p>
            <div className="mt-grid">
              {MATTRESS_TYPES.map((type) => (
                <article key={type.slug} className="mt-card">
                  <div className="mt-card-figure">
                    <MattressCutaway type={type} />
                  </div>
                  <div className="mt-card-body">
                    <div className="mt-card-head">
                      <h3 className="h3 mt-card-name">{type.name}</h3>
                      <span className="mt-price" aria-label={`Relative price: ${type.priceTier.length} of 3`}>
                        {type.priceTier}
                      </span>
                    </div>
                    <p className="mt-tagline">{type.tagline}</p>

                    <ul className="mt-layers" aria-label={`${type.name} construction, top to bottom`}>
                      {type.layers.map((l) => (
                        <li key={l.label}>
                          <span className="mt-layer-dot" style={{ background: l.fill }} aria-hidden="true" />
                          {l.label}
                        </li>
                      ))}
                    </ul>

                    <dl className="mt-ratings">
                      {FEEL_AXES.map((axis) => (
                        <div key={axis.key} className="mt-rating-row">
                          <dt className="mt-rating-label">{axis.label}</dt>
                          <dd className="mt-rating-val">
                            <RatingBar value={type.ratings[axis.key]} label={axis.label} />
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <ul className="mt-tags" aria-label={`${type.name} is best for`}>
                      {type.bestFor.map((tag) => (
                        <li key={tag} className="mt-tag">{tag}</li>
                      ))}
                    </ul>

                    <p className="mt-watch">
                      <Icon name="alert" size={15} aria-hidden="true" />
                      <span><strong>Trade-off:</strong> {type.watchOut}</span>
                    </p>

                    <Link href={type.collectionHref} className="mt-shop link-arrow">
                      Shop {type.name.toLowerCase()} mattresses <Icon name="arrow-right" size={14} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Comparison matrix, the same ratings, cross-tabulated so a
              shopper can scan one axis across all four types. */}
          <section className="mt-matrix" aria-labelledby={MATRIX_HEADING_ID}>
            <h2 id={MATRIX_HEADING_ID} className="h2 mt-section-h">Feel comparison at a glance</h2>
            <p className="muted mt-section-lede">
              Every type rated 1–5 on the six things that decide comfort. More filled dots is more of that quality.
            </p>
            <div className="mt-matrix-scroll">
              <table className="mt-matrix-table">
                <caption className="sr-only">Mattress types compared across pressure relief, support, cooling, motion isolation, responsiveness, and durability</caption>
                <thead>
                  <tr>
                    <th scope="col">Feel</th>
                    {MATTRESS_TYPES.map((t) => (
                      <th scope="col" key={t.slug}>
                        <Link href={t.collectionHref}>{t.name}</Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEEL_AXES.map((axis) => (
                    <tr key={axis.key}>
                      <th scope="row">{axis.label}</th>
                      {MATTRESS_TYPES.map((t) => (
                        <td key={t.slug}>
                          <RatingDots value={t.ratings[axis.key]} label={`${t.name} ${axis.label}`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
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
    </>
  );
}
