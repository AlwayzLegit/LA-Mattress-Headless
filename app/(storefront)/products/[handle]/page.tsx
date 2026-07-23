import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { getProductByHandle, getProductRecommendations } from '@/lib/shopify';
import type { Product, ProductSummary } from '@/lib/shopify';
import { products as inventoryProducts, findProduct } from '@/lib/inventory';
import { capTitle, ensureTitleDistinctFromH1, pdpTitleBase, truncDescription, firstNonEmpty, stripBrandSuffix } from '@/lib/seo';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { pickPrimaryCollection } from '@/lib/product-jsonld';
import { buildProductAboutSentences, isThinDescription, buildProductFaq } from '@/lib/product-copy';
import { renderFaqAnswer } from '@/lib/faq-render';
import { Icon } from '@/app/_components/icon';
import { ReviewsBadge } from '@/app/_components/reviews-badge';
import { RecordRecentlyViewed, RecentlyViewedRail } from '@/app/_components/recently-viewed';
import { PdpReviewsSection } from '@/app/_components/pdp-reviews-section';
import { TrackPdpView } from '@/app/_components/track-pdp-view';
import { PdpDeliveryCutoff } from '@/app/_components/pdp-delivery-cutoff';
import { formatMonthlyPayment, FINANCING_DEFAULT_MONTHS } from '@/lib/financing-calc';
import { BuyBox } from './buy-box';
import { PdpCtaRow } from './pdp-cta-row';
import { PdpGallery } from './gallery';
import { PdpOverview } from './pdp-overview';
import { PdpFirmness } from './pdp-firmness';
import { PdpMaterials } from './pdp-materials';
import { PdpBrandStory } from './pdp-brand-story';
import { RelatedRail } from './related-rail';
import { ProductSkeleton } from './skeleton';

type Params = { params: Promise<{ handle: string }> };

// 24h ISR window — relies on the products/* Shopify webhooks
// (configured in Admin → Notifications) to invalidate the
// `product:<handle>` cache tag immediately when a product is
// updated, so real-time freshness on edits is preserved. The long
// expiry just controls the natural-decay safety net for the rare
// case the webhook misses a payload. Previous 10-min window meant
// every PDP regenerated every 10 minutes regardless of edit
// activity; with hundreds of PDPs and active traffic this kept
// the lambda warm but also paid the SSR cost constantly.
export const revalidate = 86400;
export const dynamicParams = true;

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);

export function generateStaticParams() {
  // Skip static pre-rendering when Storefront credentials aren't configured —
  // lets `next build` succeed in a fresh checkout. With env set, we pre-build
  // the top revenue PDPs from §4 of the brief; the rest render on-demand
  // via dynamicParams=true.
  if (!SHOPIFY_CONFIGURED) return [];
  const priorityHandles = new Set([
    'the-luxe-estate-firm-by-stearns-foster',                              // top revenue
    'englander-amsbury-pillow-top-mattress',
    'tempur-pedic-mattress-clearance-tempur-proadapt-medium-12',
    'eastman-house-avalon-late-firm',
    'spruce-firm-innerspring-by-eclipse-mattress',
    'diamond-dreamstage-2-0-collection-glory-firm-cool-gel-swirl-memory-foam-12-mattress',
    'bia-universal-flat-foundation',
    'rock-extra-firm-mattress-diamond-mattress',
    'diamond-dreamstage-2-0-medium-gel-swirl-memory-foam-12-mattress',
    'bunkie-board-mattress-foundation',
    'tempur-pedic-tempur-proadapt-medium-hybrid',
    'tempur-pedic-tempur-luxeadapt-firm-mattress',
    'lismore-luxury-firm-mattress-palace-collection-by-chattam-wells',
    'harvest-green-original-firm-natural-latex-by-diamond-mattress',
  ]);
  return inventoryProducts
    .filter((p) => priorityHandles.has(p.handle))
    .map((p) => ({ handle: p.handle }));
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) return { title: 'Product' };
  const product = await getProductByHandle(params.handle).catch(() => null);
  if (!product) return { title: 'Product not found' };
  // Phase 277c: when Shopify SEO title isn't set (~35% of products per
  // the 2026-05 audit), fall back to a local-intent variant rather than
  // the bare product title. Otherwise the <title> would equal the H1
  // verbatim, triggering SEMrush's "Duplicate content in h1 and title".
  // Only append "in Los Angeles" when the result still fits in TITLE_MAX
  // (70 chars after Phase 289 raised it from 56) so capTitle doesn't
  // ellipsis-truncate it; long product titles fall back to the bare
  // title and rely on the unique variant signature within the first ~70
  // chars to differentiate sibling variants.
  const titleFallback = `${product.title} in Los Angeles`;
  let title = capTitle(
    firstNonEmpty(
      product.seo.title,
      titleFallback.length <= 70 ? titleFallback : product.title,
    ),
  );
  // Guard: the H1 is the bare product.title. If the resolved title
  // collapses to that same string (long product name → fallback to
  // bare title, or a merchant seo.title set identical to the product
  // name), the <title> would duplicate the H1 with no brand. Append
  // the canonical brand suffix so it stays distinct + brand-bearing.
  if (stripBrandSuffix(title).trim().toLowerCase() === product.title.trim().toLowerCase()) {
    // ensureTitleDistinctFromH1 reserves room for the suffix (caps the
    // base to 70 minus the suffix length) so the brand always survives
    // capping. The previous `capTitle(title + ' · LA Mattress Store')`
    // hit both failure modes in turn: before the middle-dot regex fix
    // it truncated INTO the suffix ("· LA Mattres…"), after it capTitle
    // dropped the whole suffix and the title collapsed back into the H1
    // (Semrush issue 105, +46 pages on the 2026-07-04 crawl).
    // pdpTitleBase drops the leading vendor from over-long names so the
    // trailing firmness word survives capping (else Firm/Medium/Soft
    // siblings collapse to one duplicate <title>).
    title = ensureTitleDistinctFromH1(`${pdpTitleBase(product.title, product.vendor)} | LA Mattress Store`, product.title);
  }
  const description = truncDescription(
    firstNonEmpty(
      product.seo.description,
      product.description,
      `${product.title}, buy at LA Mattress Store, Los Angeles.`,
    ),
  );
  const url = `/products/${product.handle}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      // QA 2026-05-23 P2-3 attempted to set type='product' here to match
      // OG spec (https://ogp.me/#types) but Next.js Metadata API's
      // discriminated-union dispatch crashes at prerender time when the
      // value isn't one of the recognized literals (website / article /
      // book / profile / music.* / video.*). Symptom was a Server
      // Components render error on /products/[handle] during static
      // generation — broke 3 production deploys (PRs #253-#255 ERROR
      // state). Reverted to 'website' to unblock the build.
      //
      // Follow-up path (not in this hotfix): emit an additional
      // <meta property="og:type" content="product"> alongside the
      // Metadata-generated tag via a custom <head> child in the route,
      // OR upgrade Next.js to a version whose OpenGraph types accept
      // 'product' natively. For now PDPs unfurl as generic-link cards
      // on FB/LinkedIn, same as before PR #253.
      type: 'website',
      url,
      title,
      description,
      // PDPs almost always have a featuredImage. The fallback to
      // app/opengraph-image.tsx is belt-and-braces for the rare
      // missing-image case — Next.js doesn't auto-merge the file
      // convention into a route's openGraph block.
      images: product.featuredImage
        ? [{ url: product.featuredImage.url, alt: product.featuredImage.altText ?? product.title }]
        : [{ url: '/opengraph-image', width: 1200, height: 630 }],
    },
  };
}

export default async function ProductPage(props: Params) {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) notFound();

  // Hybrid: known handles (in inventory snapshot) take the Suspense fast-path
  // with a skeleton during navigation. Unknown handles fall through to a
  // synchronous fetch — bad URLs hit notFound() OUTSIDE any Suspense, which
  // is the only way to emit a real HTTP 404 in Next 15 (notFound() called
  // inside a Suspense streams as 200 with the not-found body in the chunked
  // response — confirmed in Phase 19).
  if (findProduct(params.handle)) {
    return (
      <Suspense fallback={<ProductSkeleton />}>
        <ProductBody handle={params.handle} />
      </Suspense>
    );
  }

  // Upstream failures throw (5xx / stale-ISR-keeps-serving) — only a genuine
  // Shopify "no such handle" (null) may 404. See the pages/[handle] note.
  const product = await getProductByHandle(params.handle);
  if (!product) notFound();
  const related = await getProductRecommendations(product.handle).catch(() => [] as ProductSummary[]);
  return <ProductView product={product} related={related} />;
}

async function ProductBody({ handle }: { handle: string }) {
  const [product, related] = await Promise.all([
    getProductByHandle(handle).catch(() => null),
    getProductRecommendations(handle).catch(() => [] as ProductSummary[]),
  ]);
  if (!product) notFound();
  return <ProductView product={product} related={related} />;
}

function SpecTable({ product }: { product: Product }) {
  const { specs } = product;
  const sizeOpt = product.options.find((o) => /size/i.test(o.name));
  // Order matches the design handoff §Specs (pdp-showroom.css).
  const rows: { label: string; value: string }[] = [];
  if (specs.heightInches !== null)     rows.push({ label: 'Height',     value: `${specs.heightInches}"` });
  if (specs.firmness)                  rows.push({ label: 'Firmness',   value: specs.firmness });
  if (specs.materialType)              rows.push({ label: 'Materials',  value: specs.materialType });
  else if (product.productType)        rows.push({ label: 'Type',       value: product.productType });
  if (sizeOpt && sizeOpt.values.length) rows.push({ label: 'Sizes',     value: sizeOpt.values.join(', ') });
  if (specs.trialNights !== null)      rows.push({ label: 'Trial',      value: `${specs.trialNights} nights` });
  if (specs.warrantyYears !== null)    rows.push({ label: 'Warranty',   value: `${specs.warrantyYears} years` });
  rows.push({ label: 'Brand', value: product.vendor });

  if (rows.length === 0) return null;
  return (
    <section className="pdp-section pdp-specs">
      <div className="pdp-section-head">
        <div>
          <div className="eyebrow">Specifications</div>
          <h2 className="h2">The details.</h2>
        </div>
      </div>
      <dl className="pdp-specs-grid">
        {rows.map((r) => (
          <div key={r.label} className="pdp-spec">
            <dt className="muted pdp-spec-k">{r.label}</dt>
            <dd className="pdp-spec-v">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SpecStrip({ specs }: { specs: Product['specs'] }) {
  // Render only the spec values that are actually populated. Order matches
  // the buying-decision priority: material → firmness → height. Values
  // separated by middle-dot for a tight, scannable strip.
  const items: string[] = [];
  if (specs.materialType) items.push(specs.materialType);
  if (specs.firmness)     items.push(specs.firmness);
  if (specs.heightInches !== null) items.push(`${specs.heightInches}"`);
  if (items.length === 0) return null;
  return (
    <div className="pdp-spec-strip" aria-label="Mattress specs">
      {items.map((s, i) => (
        <span key={i} className="pdp-spec-strip-item">{s}</span>
      ))}
    </div>
  );
}

/**
 * Store-facts paragraph: the store's real delivery / financing / showroom
 * facts, plus three topically-relevant internal links (financing,
 * locations, primary collection) onto an otherwise link-poor PDP. Shared
 * by the empty-description fallback and the thin-description top-up so the
 * copy stays in one place. Returns a bare <p> — callers wrap it in `.rte`.
 */
function PdpStoreFacts({ product }: { product: Product }) {
  const primary = pickPrimaryCollection(product.collections);
  return (
    <p>
      Order it for free white-glove delivery anywhere in Los Angeles, setup and
      old-mattress haul-away included, same-day when you order by 4&nbsp;pm.{' '}
      <Link href="/pages/mattress-store-financing">0% APR financing</Link> is available
      through Synchrony and Acima, and you can try it in person at any of our{' '}
      <Link href="/pages/mattress-store-locations">5 Los Angeles showrooms</Link>.
      {primary ? (
        <>
          {' '}
          Browse more in <Link href={`/collections/${primary.handle}`}>{primary.title}</Link>.
        </>
      ) : null}
    </p>
  );
}

/**
 * Body fallback for PDPs with NO merchant-authored Shopify description.
 * Renders a factual paragraph derived from the product's own specs (see
 * lib/product-copy.ts) plus the shared store-facts paragraph — so the
 * "About" section never silently vanishes and leaves a chrome-only, thin
 * page (SEMrush issue 112). Renders nothing when the product has no
 * populated specs to describe (same as the previous `null` branch).
 */
function ProductAboutFallback({ product }: { product: Product }) {
  const about = buildProductAboutSentences(product);
  if (about.length === 0) return null;
  return (
    <section className="pdp-description">
      <div className="eyebrow">Details</div>
      <h2 className="h2">About this mattress</h2>
      <div className="rte">
        <p>{about.join(' ')}</p>
        <PdpStoreFacts product={product} />
      </div>
    </section>
  );
}

/**
 * Top-up appended under a thin (but non-empty) merchant description. The
 * spec-derived sentences are distinct structured facts (build, feel, sizes,
 * coverage) that enrich the page without overriding the merchant's prose;
 * the store-facts paragraph then adds delivery/financing/showroom context
 * plus the internal links. Together they lift a one-liner PDP over the
 * thin-content threshold (SEMrush issue 112 / 223) with real data.
 */
function ThinDescriptionTopUp({ product }: { product: Product }) {
  const about = buildProductAboutSentences(product);
  return (
    <div className="rte" style={{ marginTop: 'var(--s-4)' }}>
      {about.length ? <p>{about.join(' ')}</p> : null}
      <PdpStoreFacts product={product} />
    </div>
  );
}

/**
 * Per-product FAQ block (SEMrush 20260616 audit). Adds visible body text
 * + a FAQPage structured-data block (emitted in product-jsonld.ts) to
 * every PDP. Store-policy + warranty Q&A with the product name
 * interpolated so each block is distinct. Reuses the sitewide
 * <details>-based FAQ markup + styling (app/_components/sections/faq.tsx).
 */
function PdpFaq({ product }: { product: Product }) {
  const items = buildProductFaq(product);
  if (items.length === 0) return null;
  return (
    <section className="pdp-section pdp-faq">
      <div className="pdp-section-head">
        <div>
          <div className="eyebrow">FAQ</div>
          <h2 className="h2">Common questions</h2>
        </div>
      </div>
      <div className="faq-list">
        {items.map((it, i) => (
          <details key={it.q} className="faq-item" open={i === 0}>
            <summary className="faq-q">
              <span>{it.q}</span>
              <span className="faq-icon faq-icon-closed"><Icon name="plus" size={18} /></span>
              <span className="faq-icon faq-icon-open"><Icon name="minus" size={18} /></span>
            </summary>
            <div className="faq-a">
              <p>{renderFaqAnswer(it.a)}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function ProductView({ product, related }: { product: Product; related: ProductSummary[] }) {
  const minPrice = Number.parseFloat(product.priceRange.minVariantPrice.amount);
  const inStock = product.variants.some((v) => v.availableForSale !== false);
  return (
    <main className="container pdp">
      <TrackPdpView
        handle={product.handle}
        title={product.title}
        vendor={product.vendor}
        productType={product.productType}
        price={Number.isFinite(minPrice) ? minPrice : undefined}
        currency={product.priceRange.minVariantPrice.currencyCode}
        inStock={inStock}
      />
      <nav className="lp-breadcrumbs" aria-label="Breadcrumb" style={{ paddingTop: 'var(--s-5)' }}>
        <Link href="/">Home</Link>
        <span className="sep" aria-hidden="true">/</span>
        <Link href="/collections/mattresses">Mattresses</Link>
        {(() => {
          // Primary-collection-aware breadcrumb. Must match the JSON-LD
          // BreadcrumbList emitted in lib/product-jsonld.ts — Google
          // flags any divergence between visible breadcrumb and JSON-LD
          // as a structured-data mismatch in Search Console.
          const primary = pickPrimaryCollection(product.collections);
          return primary ? (
            <>
              <span className="sep" aria-hidden="true">/</span>
              <Link href={`/collections/${primary.handle}`}>{primary.title}</Link>
            </>
          ) : null;
        })()}
        <span className="sep" aria-hidden="true">/</span>
        <span>{product.title}</span>
      </nav>

      <div className="pdp-grid">
        <div className="pdp-gallery-area">
          <PdpGallery
            productTitle={product.title}
            featured={product.featuredImage}
            images={product.images}
          />
        </div>

        <aside className="pdp-rail">
          <div className="pdp-rail-inner">
            <div className="pdp-brand-mark">{product.vendor}</div>
            <h1 className="pdp-name">{product.title}</h1>
            {product.editorial.tagline ? (
              <p className="pdp-tagline muted">{product.editorial.tagline}</p>
            ) : null}
            <ReviewsBadge reviews={product.reviews} size="block" />

            <BuyBox
              options={product.options}
              variants={product.variants}
              priceRange={product.priceRange}
              compareAtPriceRange={product.compareAtPriceRange}
              productTitle={product.title}
              productImage={product.featuredImage}
            />

            {/* Financing-per-month callout below the price psychology of
                the BuyBox. Renders only for products $1,500+, the
                Synchrony promo minimum. Industry-standard pattern
                (Tempur-Pedic, Saatva, Casper all carry this) that reframes
                a $2,699 mattress as a $112/mo decision. Links to the
                financing page so a curious shopper can see terms. */}
            {(() => {
              const monthly = formatMonthlyPayment(
                product.priceRange.minVariantPrice.amount,
                FINANCING_DEFAULT_MONTHS,
              );
              if (!monthly) return null;
              return (
                <Link href="/pages/mattress-store-financing" className="pdp-financing-line">
                  <Icon name="card" size={14} />
                  <span>
                    From <strong className="tnum">{monthly}</strong> with 0% APR financing over {FINANCING_DEFAULT_MONTHS} months →
                  </span>
                </Link>
              );
            })()}

            <PdpCtaRow
              handle={product.handle}
              title={product.title}
              vendor={product.vendor}
              imageUrl={product.featuredImage?.url ?? null}
              imageAlt={product.featuredImage?.altText ?? null}
              priceAmount={product.priceRange.minVariantPrice.amount}
              priceCurrency={product.priceRange.minVariantPrice.currencyCode}
            />

            {/* Live same-day-delivery cutoff indicator. Counts down to
                the 4 PM LA cutoff during the day; switches to
                "tomorrow" copy after. Client-only render so the
                time-dependent string doesn't break ISR hydration. */}
            <PdpDeliveryCutoff />

            <div className="pdp-delivery">
              <div className="pdp-delivery-row">
                <Icon name="truck" size={18} />
                <div>
                  <div className="pdp-delivery-title">Free white-glove delivery</div>
                  <div className="muted pdp-delivery-sub">Free setup &amp; old mattress haul-away on orders $499+ · Same-day anywhere in LA when you order by 4pm</div>
                </div>
              </div>
              <div className="pdp-delivery-row">
                <Icon name="shield" size={18} />
                <div>
                  <div className="pdp-delivery-title">120-night comfort exchange</div>
                  <div className="muted pdp-delivery-sub">Sleep on it for 4 months, exchange free if it isn&rsquo;t right</div>
                </div>
              </div>
              <div className="pdp-delivery-row">
                <Icon name="card" size={18} />
                <div>
                  <div className="pdp-delivery-title">0% APR financing</div>
                  <div className="muted pdp-delivery-sub">Synchrony or Acima · terms vary by approval · apply at checkout</div>
                </div>
              </div>
              {/* Showroom-bridge: closes the loop between PDP and the
                  locations page. Pattern lifted from Apple's "Available
                  at Apple stores" link under the buy box. */}
              <Link href="/pages/mattress-store-locations" className="pdp-delivery-row pdp-delivery-link">
                <Icon name="pin" size={18} />
                <div>
                  <div className="pdp-delivery-title">Try it at a showroom</div>
                  <div className="muted pdp-delivery-sub">On the floor at all 5 LA showrooms, Koreatown, West LA, La Brea, Studio City, Glendale →</div>
                </div>
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {/* Lower content lives BELOW the gallery/buy-box grid (not in the
          grid's left column) so it spans a centered, balanced width instead
          of being pinned to ~60% with the 440px buy-box gutter empty to its
          right. See .pdp-details-area in globals.css. */}
      <div className="pdp-details-area">
          <PdpOverview product={product} />
          <PdpFirmness product={product} />
          <PdpMaterials product={product} />
          <SpecTable product={product} />

          {product.descriptionHtml?.trim() ? (
            <section className="pdp-description">
              <div className="eyebrow">Details</div>
              <h2 className="h2">About this mattress</h2>
              <div className="rte" dangerouslySetInnerHTML={{ __html: autoLinkArticleBody(sanitizeShopifyHtml(product.descriptionHtml)) }} />
              {/* Short merchant copy still leaves the page thin (SEMrush
                  issue 112), top it up with the spec-derived paragraph +
                  the store-facts paragraph + internal links rather than
                  overriding the merchant prose. The spec sentences are
                  distinct structured facts (height, build, feel, sizes,
                  coverage), so they enrich rather than duplicate. */}
              {isThinDescription(product.descriptionHtml) ? (
                <ThinDescriptionTopUp product={product} />
              ) : null}
            </section>
          ) : (
            <ProductAboutFallback product={product} />
          )}

          {/* Brand band (Round 13). The brand story that used to be
              duplicated inside every Diamond/Helix product description
              now renders here once, in a consistent template position.
              Self-gates: shows nothing until the description strip
              removes the in-body copy, so deploy order doesn't matter. */}
          <PdpBrandStory vendor={product.vendor} descriptionHtml={product.descriptionHtml} />

          <PdpFaq product={product} />
        </div>

      <PdpReviewsSection
        productGid={product.id}
        productHandle={product.handle}
        reviews={product.reviews}
      />

      <RelatedRail products={related} />
      <RecentlyViewedRail excludeHandle={product.handle} />
      <RecordRecentlyViewed product={product} />

    </main>
  );
}
