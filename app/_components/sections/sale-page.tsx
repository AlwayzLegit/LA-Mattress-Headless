import Link from 'next/link';
import Image from 'next/image';

import type { Page } from '@/lib/shopify/types';
import type { ProductSummary } from '@/lib/shopify';
import { stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';
import { buildSaleEventLd } from '@/lib/sale-event-ld';
import { SalePageCtaTracker } from '@/app/_components/sale-page-cta-tracker';
import { Icon } from '@/app/_components/icon';
import { PlpCard } from '@/app/_components/plp-card';

/**
 * Phase 277/278: sale-page template. Activated by handle pattern
 * (SALE_HANDLE_PATTERNS). The layout is:
 *
 *   1. Full-bleed navy hero — title + bodySummary lede + dual CTAs.
 *   2. Trust strip — 3 quick reassurance points (delivery, financing,
 *      120-night exchange) that match the homepage TrustBar.
 *   3. Category chips — pill-shaped links into the major mattress
 *      sub-categories so shoppers can drill in immediately.
 *   4. Featured product grid — 12 best-selling products from the
 *      `on-sale` collection (fetched server-side in the page handler),
 *      using the standard PlpCard so the look matches every other PLP.
 *   5. "See all N mattresses on sale" link to /collections/on-sale.
 *   6. Merchant-authored body content — the long-form sale copy from
 *      Shopify Admin (terms, brand callouts, showroom hours, etc.).
 *   7. Footer CTA — Shop the Sale + Find a showroom buttons.
 *
 * The product grid + category chips + trust strip mean the page is
 * visually substantive even when the merchant body is empty or thin.
 *
 * Extracted from app/(storefront)/pages/[handle]/page.tsx (deep audit
 * codeq-godfile-01) — pure move, no behavior change.
 */
export const SALE_CATEGORY_CHIPS = [
  { label: 'Memory foam',     href: '/collections/memory-foam-mattresses' },
  { label: 'Hybrid',          href: '/collections/hybrid-mattresses' },
  { label: 'Latex',           href: '/collections/latex-mattresses' },
  { label: 'Innerspring',     href: '/collections/innerspring-mattresses' },
  { label: 'Tempur-Pedic',    href: '/collections/tempur-pedic-mattresses' },
  { label: 'Stearns & Foster', href: '/collections/stearns-foster-mattresses' },
  { label: 'Helix',           href: '/collections/helix-mattresses' },
  { label: 'Adjustable bases', href: '/collections/adjustable-beds' },
];

/**
 * High-intent "shop the sale by …" cards surfaced on every sale page.
 * Points at the evergreen category collections (queen/king/firm/memory-foam)
 * that own the real search demand — "queen mattress sale" (~14.8k/mo) +
 * "king mattress sale" (~9.9k/mo) dwarf any holiday-specific phrasing — so
 * the holiday hub funnels shoppers into pages that rank year-round, and the
 * internal links reinforce those collections' SEO.
 */
const SALE_SHOP_BY = [
  { label: 'Queen Mattress Sale', href: '/collections/queen-size-mattresses', sub: "America's most popular size, from $319" },
  { label: 'King Mattress Sale', href: '/collections/king-size-mattresses', sub: 'Maximum space for couples, from $499' },
  { label: 'Firm Mattress Sale', href: '/collections/firm-mattress', sub: 'Solid support for back & stomach sleepers' },
  { label: 'Memory Foam Sale', href: '/collections/memory-foam-mattresses', sub: 'Contouring pressure relief' },
];

/**
 * "Read more" guides linked from the sale page so shoppers can research
 * before buying (and so the hub passes link equity to the supporting
 * Mattress Buying Guide articles). Evergreen — relevant on every sale page.
 */
const SALE_GUIDES = [
  { title: '4th of July Mattress Sale in LA: Best Deals & Buyer’s Guide', href: '/blogs/mattress-buying-guide/4th-of-july-mattress-sale-los-angeles' },
  { title: 'Best Queen & King Mattress Deals: How to Save', href: '/blogs/mattress-buying-guide/best-queen-and-king-mattress-deals' },
  { title: 'When Is the Best Time to Buy a Mattress?', href: '/blogs/mattress-buying-guide/best-time-to-buy-a-mattress-holiday-sales' },
];

// buildSaleEventLd lives in lib/sale-event-ld.ts for unit-testability
// (tests/ssr/lib-sale-event-ld.test.mjs). Single source of truth for
// the SaleEvent + AggregateOffer JSON-LD shape the page emits.

export function SalePage({
  page,
  featuredProducts,
  onSaleCount,
  saleCollectionHref = '/collections/on-sale',
  isPreview = false,
}: {
  page: Page;
  featuredProducts: ProductSummary[];
  onSaleCount: number;
  // Destination for the primary "Shop the Sale" CTAs — the event's own
  // curated collection when one exists (e.g. /collections/4th-of-july-
  // mattress-sale), else the broad /collections/on-sale. Resolved in the
  // page handler alongside featuredProducts so the CTA and the product
  // grid always point at the same collection.
  saleCollectionHref?: string;
  isPreview?: boolean;
}) {
  const cleanTitle = toSentenceCase(stripBrandSuffix(page.title));
  const isPreLaunch = Boolean(
    page.availableAt && Number.isFinite(Date.parse(page.availableAt)) && Date.now() < Date.parse(page.availableAt),
  );
  // Once `custom.sale_ends_at` is in the past, the page stays live (good
  // for evergreen "what is the X sale" search intent) but flips into an
  // "ended" mode: a banner explains the sale closed and points to
  // current offers, and the SaleEvent JSON-LD downgrades eventStatus.
  // Keeping the URL indexable beats 404'ing after the event — emails
  // sent during the sale keep working as archive links.
  const saleEndedAt = page.saleEndsAt ? Date.parse(page.saleEndsAt) : NaN;
  const saleHasEnded = Number.isFinite(saleEndedAt) && Date.now() > saleEndedAt;
  // Primary CTA target. While the sale is live, send shoppers to the
  // event's own collection. Once it's ended, the curated collection is
  // stale, so point "See current offers" at the always-fresh on-sale set.
  const primarySaleHref = saleHasEnded ? '/collections/on-sale' : saleCollectionHref;
  const saleEventLd = buildSaleEventLd(page, featuredProducts, onSaleCount);

  return (
    <main>
      {isPreview && isPreLaunch ? (
        <div
          role="status"
          // Preview-mode banner. Tells the merchant they're seeing a
          // pre-launch URL via the SALE_PAGE_PREVIEW_TOKEN bypass and
          // warns that the public sees a 404 here. Inline styles so
          // it works regardless of theme/CSS-load order.
          style={{
            background: '#ffe9b3',
            color: '#5a3d00',
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
            borderBottom: '1px solid #d4a700',
          }}
        >
          Preview mode, this sale page is not yet live to the public (goes live{' '}
          {page.availableAt
            ? new Date(page.availableAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
            : 'on its scheduled date'}
          ). The page is currently hidden by the storefront date gate.
        </div>
      ) : null}
      {!isPreLaunch && saleEventLd ? (
        <script
          type="application/ld+json"
          // SaleEvent / AggregateOffer JSON-LD. Emitted from the page
          // (not the layout) because only the page handler has the
          // resolved featuredProducts + onSaleCount that feed
          // lowPrice / highPrice / offerCount. Suppressed in preview
          // mode so the pre-launch URL never seeds Google's sale
          // rich-result cache ahead of the real go-live.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(saleEventLd) }}
        />
      ) : null}
      <SalePageCtaTracker
        handle={page.handle}
        saleStartsAt={page.saleStartsAt}
        saleEndsAt={page.saleEndsAt}
        isPreLaunch={isPreLaunch}
        isPostSale={saleHasEnded}
        isPreview={isPreview}
        featuredProductCount={featuredProducts.length}
      />
      <header className={`sale-page-hero${page.coverImage ? ' sale-page-hero--image' : ''}`}>
        {page.coverImage ? (
          <Image
            src={page.coverImage.url}
            alt=""
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            quality={60}
            className="sale-page-hero-bg"
          />
        ) : null}
        <div className="container sale-page-hero-inner">
          <nav className="lp-breadcrumbs sale-page-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="sep" aria-hidden="true">/</span>
            <span>{cleanTitle}</span>
          </nav>
          <div className="eyebrow eyebrow-on-dark sale-page-eyebrow">
            {saleHasEnded ? 'Sale ended' : 'Limited-time event'}
          </div>
          <h1 className="sale-page-title">{cleanTitle}</h1>
          {saleHasEnded ? (
            <p className="sale-page-lede">
              This event has ended. The brands featured here are usually included in our next sale, check current offers below, or call us at{' '}
              <a href={`tel:${SITE_PHONE_TEL}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{SITE_PHONE_DISPLAY}</a>{' '}
              for early access to upcoming markdowns.
            </p>
          ) : page.bodySummary ? (
            <p className="sale-page-lede">{page.bodySummary}</p>
          ) : null}
          <div className="sale-page-ctas">
            <Link
              href={primarySaleHref}
              className="btn btn-lg btn-on-dark"
              data-cta="shop_the_sale"
              data-cta-position="hero"
            >
              {saleHasEnded ? 'See current offers' : 'Shop the Sale'} <Icon name="arrow-right" size={16} />
            </Link>
            <Link
              href="/pages/mattress-store-locations"
              className="btn btn-lg btn-ghost-on-dark"
              data-cta="find_a_showroom"
              data-cta-position="hero"
            >
              Find a showroom
            </Link>
          </div>
        </div>
      </header>

      {/* Trust strip, same trio used by the homepage TrustBar. Visible
          immediately below the hero so the value-prop is reinforced
          before the shopper scrolls into the grid. */}
      <section className="sale-page-trust" aria-label="What's included with every order">
        <div className="container sale-page-trust-inner">
          <div className="sale-page-trust-item">
            <Icon name="truck" size={20} />
            <div>
              <div className="sale-page-trust-title">Free LA delivery</div>
              <div className="sale-page-trust-sub">White-glove on orders over $499. Same-day if you order by 4 PM.</div>
            </div>
          </div>
          <div className="sale-page-trust-item">
            <Icon name="card" size={20} />
            <div>
              <div className="sale-page-trust-title">0% APR financing</div>
              <div className="sale-page-trust-sub">Synchrony or Acima on approved credit. 60-second application.</div>
            </div>
          </div>
          <div className="sale-page-trust-item">
            <Icon name="shield" size={20} />
            <div>
              <div className="sale-page-trust-title">120-night exchange</div>
              <div className="sale-page-trust-sub">Sleep 30 nights, exchange for any other mattress if it&rsquo;s not right.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured product grid, first 12 best-sellers from the on-sale
          collection. Same PlpCard component every other PLP uses, so
          the look stays consistent and shoppers see real product cards
          with prices, ratings, brand tags, etc. */}
      {featuredProducts.length > 0 ? (
        <section className="sale-page-grid-section" aria-labelledby="sale-grid-h">
          <div className="container">
            <header className="sale-page-grid-head">
              <h2 id="sale-grid-h" className="h2">Featured deals</h2>
              <p className="muted">A few of our best-selling mattresses currently on sale. {onSaleCount > 12 ? `${onSaleCount}+ models discounted in total, see all below.` : null}</p>
              <nav className="sale-page-chips" aria-label="Shop by category">
                {SALE_CATEGORY_CHIPS.map((chip) => (
                  <Link key={chip.href} href={chip.href} className="sale-page-chip">
                    {chip.label}
                  </Link>
                ))}
              </nav>
            </header>
            <div className="plp-grid">
              {featuredProducts.map((p, i) => (
                <PlpCard key={p.id} product={p} priority={i < 3} />
              ))}
            </div>
            <div className="sale-page-grid-foot">
              <Link
                href="/collections/on-sale"
                className="btn btn-primary btn-lg"
                data-cta="see_every_mattress"
                data-cta-position="grid"
              >
                See every mattress on sale <Icon name="arrow-right" size={16} />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* Shop-by-category cards, the high-intent evergreen collections
          (queen/king/firm/memory-foam) the holiday hub supports. Gives
          shoppers a fast path into the catalog and reinforces those
          collections' "[x] mattress sale" rankings via internal links. */}
      <section className="sale-page-shopby" aria-labelledby="sale-shopby-h">
        <div className="container">
          <header className="sale-page-grid-head">
            <h2 id="sale-shopby-h" className="h2">Shop the sale by size &amp; feel</h2>
            <p className="muted">Jump to the most-shopped categories, every one is included in the sale.</p>
          </header>
          <div className="sale-page-shopby-grid">
            {SALE_SHOP_BY.map((c) => (
              <Link key={c.href} href={c.href} className="sale-page-shopby-card">
                <span className="sale-page-shopby-label">{c.label}</span>
                <span className="sale-page-shopby-sub">{c.sub}</span>
                <span className="sale-page-shopby-arrow" aria-hidden="true"><Icon name="arrow-right" size={16} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Merchant-authored long-form body. Sale terms, brand callouts,
          showroom hours, etc., anything they type into the Shopify
          page body renders here. */}
      {page.body ? (
        <article className="container sale-page-body">
          <div className="rte cms-body" dangerouslySetInnerHTML={{ __html: autoLinkArticleBody(sanitizeShopifyHtml(page.body)) }} />
        </article>
      ) : null}

      {/* "Read more" guides, links to the supporting Mattress Buying
          Guide articles so undecided shoppers can research, and so the
          hub passes link equity to that cluster. */}
      <section className="sale-page-guides" aria-labelledby="sale-guides-h">
        <div className="container">
          <header className="sale-page-grid-head">
            <h2 id="sale-guides-h" className="h2">Mattress sale guides</h2>
            <p className="muted">New to mattress shopping? These quick reads help you buy smart.</p>
          </header>
          <ul className="sale-page-guides-list">
            {SALE_GUIDES.map((g) => (
              <li key={g.href}>
                <Link href={g.href} className="sale-page-guide-link">
                  <span>{g.title}</span>
                  <Icon name="arrow-right" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer CTA, repeat the primary action at the end of the page
          so a shopper who scrolled all the way down doesn't have to
          scroll back up to convert. */}
      <section className="sale-page-foot-cta">
        <div className="container sale-page-foot-cta-inner">
          <h2 className="h2">Ready to upgrade your sleep?</h2>
          <p className="muted">Free LA delivery, 0% APR financing, 120-night exchange. Every mattress on the floor at all 5 showrooms.</p>
          <div className="sale-page-ctas">
            <Link
              href={primarySaleHref}
              className="btn btn-primary btn-lg"
              data-cta="shop_the_sale"
              data-cta-position="footer"
            >
              Shop the Sale <Icon name="arrow-right" size={16} />
            </Link>
            <Link
              href="/sleep-quiz"
              className="btn btn-ghost btn-lg"
              data-cta="sleep_quiz"
              data-cta-position="footer"
            >
              Take the 2-min quiz
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
