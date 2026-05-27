import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import Image from 'next/image';

import { getPageByHandle, getCollectionByHandle } from '@/lib/shopify';
import type { ProductSummary } from '@/lib/shopify';
import { publishedPages } from '@/lib/inventory';
import { SHOWROOMS, findShowroom, formatPhone, type Showroom } from '@/lib/showrooms';
import { findNeighborhood, getNearestShowrooms, type Neighborhood } from '@/lib/neighborhoods';
import { truncDescription, firstNonEmpty, stripBrandSuffix, toSentenceCase, ensureTitleDistinctFromH1 } from '@/lib/seo';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';
import { isSalePage } from '@/lib/page-jsonld';
import { isCodedPage, codedPageMeta, CODED_PAGE_HANDLES } from '@/lib/coded-pages';
import { Icon } from '@/app/_components/icon';
import { PlpCard } from '@/app/_components/plp-card';
import { BrandDirectory } from '@/app/_components/sections/brand-directory';
import { ShowroomDetail } from '@/app/_components/sections/showroom-detail';
import { ShowroomOpenStatus } from '@/app/_components/showroom-open-status';
import { FaqPage } from '@/app/_components/sections/faq-page';
import { PriceConfidencePage } from '@/app/_components/sections/price-confidence';
import { ReviewsPage } from '@/app/_components/sections/reviews-page';
import { DataOptOutPage } from '@/app/_components/sections/data-opt-out-page';

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

type Params = { params: Promise<{ handle: string }> };

// 6h ISR window for CMS pages (locations, showrooms, financing,
// returns, FAQ, sale pages). Pages change less often than 10min
// but more often than blog articles — showroom hours, sale-page
// promos, FAQ updates. No `pages/update` webhook exists in
// Shopify's Admin UI (REST-only or via Shopify Flow), so the
// revalidate window is the only natural invalidation lever for
// page-body edits. 6h is a defensible balance between freshness
// and TTFB.
export const revalidate = 21600;
export const dynamicParams = true;

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);
const SITE = 'https://www.mattressstoreslosangeles.com';

export function generateStaticParams() {
  if (!SHOPIFY_CONFIGURED) return [];
  // `reviews` / `data-sharing-opt-out` are isPublished CMS pages AND
  // coded handles — filter coded handles out of the published-pages map
  // so each param is emitted exactly once (no duplicate static params).
  return [
    ...publishedPages.filter((p) => !isCodedPage(p.handle)).map((p) => ({ handle: p.handle })),
    ...CODED_PAGE_HANDLES.map((handle) => ({ handle })),
  ];
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) return { title: 'Page' };
  if (isCodedPage(params.handle)) {
    const m = codedPageMeta(params.handle);
    const url = `/pages/${params.handle}`;
    return {
      title: { absolute: m.title },
      description: m.description,
      alternates: { canonical: url },
      openGraph: {
        type: 'article',
        url,
        title: m.title,
        description: m.description,
        images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
      },
    };
  }
  const page = await getPageByHandle(params.handle).catch(() => null);
  if (!page) return { title: 'Page not found' };
  // Mirror the SalePage storefront date gate: when `custom.available_at`
  // is in the future, hide metadata so the pre-launch URL isn't indexed
  // or shared with rich SEO data before the sale goes live.
  if (isSalePage(page.handle) && page.availableAt) {
    const t = Date.parse(page.availableAt);
    if (Number.isFinite(t) && Date.now() < t) return { title: 'Page not found' };
  }
  // Phase 289: same fix as blog articles — when the merchant hasn't
  // set a custom seo.title, append " | LA Mattress" so the title
  // differs from the H1 (H1 uses sentence-cased + brand-stripped
  // version of page.title; without a suffix the two strings collapse
  // to the same case-insensitive text and SEMrush flags duplicate).
  //
  // Phase 292 (cowork MEDIUM#5): strip any existing trailing brand
  // suffix from page.title FIRST. The auto-created neighborhood pages
  // are titled "Mattress Store in Burbank — LA Mattress"; appending
  // " | LA Mattress" to that produced a doubled brand
  // ("… — LA Mattress | LA Mattress"). stripBrandSuffix splits on the
  // first " | " / " – " / " — " separator, so we rebrand with a single
  // canonical " | LA Mattress" regardless of what suffix the merchant
  // (or the page-creation script) used.
  // Suffix with the primary ranking phrase "LA Mattress Store" (not a
  // bare " | LA Mattress" brand append) so the <title> is keyword-
  // bearing AND distinct from the H1 rather than reading as H1 +
  // boilerplate. stripBrandSuffix first so a page title that already
  // carries a brand suffix isn't double-branded.
  const titleFallback = `${stripBrandSuffix(page.title)} | LA Mattress Store`;
  // Phase 296: same guarantee as blog articles (#178) — keep the CMS
  // page <title> distinct from the rendered <h1>
  // (toSentenceCase(stripBrandSuffix(page.title))). The 20260518 _2
  // re-crawl still flagged 4 warranty pages where the merchant set
  // seo.title to the headline; ensureTitleDistinctFromH1 appends the
  // keyword-bearing brand suffix only when it would otherwise collapse.
  // Caps to TITLE_MAX internally (replaces the prior capTitle call).
  let title = ensureTitleDistinctFromH1(firstNonEmpty(page.seo.title, titleFallback), page.title);
  // SEMrush 20260521_1: `/pages/memorial-day-sale-2026` and
  // `/collections/memorial-day-sale` both rendered "Memorial Day Sale |
  // LA Mattress Store" — the merchant authored both with the same
  // base title. The page-handle convention is `<sale>-<YYYY>`, so
  // when the handle carries a year that isn't already in the title,
  // graft the year onto the title to break the duplicate. Affects only
  // year-stamped sale pages; everything else is untouched.
  const yearInHandle = /\b(20\d{2})\b/.exec(page.handle)?.[1];
  if (yearInHandle && !title.includes(yearInHandle)) {
    title = ensureTitleDistinctFromH1(
      title.replace(/( \| LA Mattress Store)?$/, ` ${yearInHandle}$1`),
      page.title,
    );
  }
  const description = truncDescription(
    firstNonEmpty(page.seo.description, page.bodySummary, `${page.title} — LA Mattress Store`),
  );
  const url = `/pages/${page.handle}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      // CMS pages here are marketing surfaces (locations, showrooms,
      // financing, returns, warranty, FAQ) — not blog posts. Use the
      // 'website' OG type so Facebook + LinkedIn don't render them with
      // the article-attribution treatment (byline + publish date + section
      // tag) that's reserved for editorial blog content.
      type: 'website',
      url,
      title,
      description,
      // Most CMS pages (locations, contact, financing, returns…) have
      // no associated cover. Reference app/opengraph-image.tsx so a
      // share renders the brand card instead of nothing — matches the
      // Phase 180 fallback already on collection / article / PDP.
      images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    },
  };
}

/**
 * Phase 277: handle-based detection for sale-template pages. Storefront
 * API doesn't expose `Page.templateSuffix`, so we use a handle
 * convention: any page whose handle contains a sale-related keyword
 * (memorial-day, black-friday, july-4, etc.) renders the SalePage
 * layout instead of the default CMS template. Merchants just need to
 * name pages with the convention; no additional Shopify configuration.
 */
// SALE_HANDLE_PATTERNS / isSalePage now live in lib/page-jsonld.ts so the
// /pages/[handle] template dispatch has a single source of truth shared
// with the segment layout's JSON-LD builder.

export default async function ShopifyPage(props: Params) {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) notFound();
  // Coded /pages/* dispatched here instead of via a standalone static
  // leaf route under app/pages/* (`reviews`, `data-sharing-opt-out`
  // previously had their own folders — Next 15.5.x failed to package
  // those leaves' own page.js into the Vercel lambda, MODULE_NOT_FOUND
  // on ISR regen). The dynamic [handle] route packages reliably, so all
  // hand-built /pages/* go through this single dispatch. For `reviews`
  // / `data-sharing-opt-out` a same-handle Shopify CMS page also exists
  // but is intentionally bypassed (interactive content lives in code).
  if (isCodedPage(params.handle)) {
    switch (params.handle) {
      case 'faq':
        return <FaqPage />;
      case 'low-price-guarantee':
        return <PriceConfidencePage />;
      case 'reviews':
        return <ReviewsPage />;
      case 'data-sharing-opt-out':
        return <DataOptOutPage />;
    }
  }
  const page = await getPageByHandle(params.handle).catch(() => null);
  if (!page) notFound();

  const showroom = findShowroom(page.handle);
  if (showroom) return <ShowroomPage page={page} showroom={showroom} />;
  if (page.handle === 'mattress-store-locations') return <LocationsIndexPage page={page} />;
  if (isSalePage(page.handle)) {
    // Storefront date gate: sale pages set `custom.available_at` to
    // (sale starts_at − 7 days) so each holiday page goes live exactly
    // a week before the event without any cron / Shopify Flow rigging.
    // When `available_at` is in the future, treat the page as 404 — the
    // page exists in Shopify but isn't yet ready for shoppers.
    if (page.availableAt) {
      const t = Date.parse(page.availableAt);
      if (Number.isFinite(t) && Date.now() < t) notFound();
    }
    // Phase 278: SalePage shows a real product grid + category chips.
    // Phase 284: prefer a curated sale collection if one exists for this
    // event (e.g. `memorial-day-sale-2026` → `/collections/memorial-day-sale`).
    // Strip a trailing `-YYYY` year suffix from the page handle and try
    // that collection first; fall back to the broader `/collections/on-sale`
    // when no curated collection exists for the event or it's empty.
    // This way new sale pages automatically light up their curated grid
    // as soon as the merchant tags products + creates the collection,
    // with no code change per sale event.
    // Year-range handles like `new-years-sale-2026-2027` carry two trailing
    // year tokens (the sale spans Dec → Jan); single `-YYYY$` regex would
    // leave `-2026` in place and miss the curated `new-years-sale` collection.
    // Strip up to two trailing year suffixes.
    const curatedHandle = page.handle.replace(/-\d{4}(-\d{4})?$/, '');
    const curated =
      curatedHandle !== page.handle
        ? await getCollectionByHandle({
            handle: curatedHandle,
            first: 12,
            sortKey: 'BEST_SELLING',
          }).catch(() => null)
        : null;
    const saleCollection =
      curated && curated.products.nodes.length > 0
        ? curated
        : await getCollectionByHandle({
            handle: 'on-sale',
            first: 12,
            sortKey: 'BEST_SELLING',
          }).catch(() => null);
    const featuredProducts = saleCollection?.products.nodes ?? [];
    const onSaleCount = saleCollection?.products.nodes.length ?? 0;
    return <SalePage page={page} featuredProducts={featuredProducts} onSaleCount={onSaleCount} />;
  }
  // Phase 277e: neighborhood pages (mattress-store-beverly-hills, etc.)
  // render the NeighborhoodPage template — physically distinct from a
  // showroom (no own address), serves an LA neighborhood from the
  // 1–2 nearest physical showrooms via FurnitureStore.areaServed.
  // Checked after the sale-page dispatch because none of the neighborhood
  // handles match SALE_HANDLE_PATTERNS, but the sale check is the cheaper
  // early-exit for the more common path.
  const neighborhood = findNeighborhood(page.handle);
  if (neighborhood) return <NeighborhoodPage page={page} neighborhood={neighborhood} />;

  return <DefaultPage page={page} />;
}

function DefaultPage({ page }: { page: Awaited<ReturnType<typeof getPageByHandle>> }) {
  if (!page) return null;

  // BreadcrumbList + WebPage JSON-LD. The locations index and showroom
  // templates already emit their own structured data; the default
  // template was emitting none, so cms pages had no rich-result eligibility
  // beyond the generic site-wide Organization/WebSite from layout.tsx.
  const cleanTitle = toSentenceCase(stripBrandSuffix(page.title));
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
        <h1 className="h1" style={{ marginTop: 'var(--s-4)' }}>{cleanTitle}</h1>
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

function summarizeHours(hours: Showroom['hours']): string {
  if (hours.length === 0) return '';
  const first = hours[0];
  const open = formatHour(first.open);
  const close = formatHour(first.close);
  return `${first.day} ${open}–${close}`;
}

function LocationsIndexPage({ page }: { page: NonNullable<Awaited<ReturnType<typeof getPageByHandle>>> }) {
  return (
    <main className="container">
      <article className="locations-page" style={{ padding: 'var(--s-7) 0 var(--s-9)' }}>
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span>Stores</span>
        </nav>

        <header className="locations-page-hero">
          <div className="eyebrow">Five LA showrooms</div>
          <h1 className="h1">{toSentenceCase(stripBrandSuffix(page.title))}</h1>
          <p className="lp-hero-lede" style={{ maxWidth: '60ch' }}>
            Try every mattress in person at any of our five showrooms across Los Angeles. Open daily — no appointment needed. Free white-glove delivery, 120-night comfort exchange, and 0% APR financing at every location.
          </p>
        </header>

        <section className="locations-trust" aria-label="What every showroom offers">
          <div className="locations-trust-item">
            <Icon name="truck" size={18} />
            <div>
              <div className="locations-trust-title">Free LA delivery</div>
              <div className="locations-trust-sub">White-glove, same-day if ordered by 4 PM</div>
            </div>
          </div>
          <div className="locations-trust-item">
            <Icon name="shield" size={18} />
            <div>
              <div className="locations-trust-title">120-night exchange</div>
              <div className="locations-trust-sub">Sleep on it, swap if it isn&rsquo;t right</div>
            </div>
          </div>
          <div className="locations-trust-item">
            <Icon name="card" size={18} />
            <div>
              <div className="locations-trust-title">0% APR financing</div>
              <div className="locations-trust-sub">Synchrony &amp; Acima — instant approval</div>
            </div>
          </div>
        </section>

        {/*
          Multi-showroom map. Uses Google Maps' legacy `output=embed`
          URL — works without a Maps Embed API key, which we don't have
          configured in env. Brand-query mode surfaces all 5 GBP-verified
          listings as numbered pins centered on Los Angeles. loading="lazy"
          + explicit dimensions reserves layout space so the iframe
          doesn't contribute to CLS, and importance="low" tells the
          browser this is non-critical (mobile users may never scroll to
          it). title is required for a11y on iframes.
        */}
        <section className="locations-map-wrap" aria-label="All five showroom locations on a map" style={{ marginTop: 'var(--s-7)' }}>
          <iframe
            title="LA Mattress Store — all five showroom locations on Google Maps"
            src="https://www.google.com/maps?q=LA+Mattress+Store+Los+Angeles&z=10&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            style={{ width: '100%', height: 360, border: 0, borderRadius: 'var(--radius-lg, 12px)' }}
          />
        </section>

        <section className="locations-grid" aria-label="Showroom directory">
          {SHOWROOMS.map((s) => (
            // Card is a <article>, not a <Link>, so we can nest the tel:
            // anchor for the phone number — nested <a> inside another <a>
            // is invalid HTML and breaks tap-to-call on iOS Safari. Two
            // links per card now: the photo + the "Store details" arrow
            // both go to the showroom page; the phone is its own tel:
            // anchor that initiates a call instead of navigating.
            <article key={s.handle} className="location-card location-card-rich">
              {s.imageUrl ? (
                <Link href={`/pages/${s.handle}`} className="location-card-photo" aria-label={`${s.name} — view details`}>
                  <Image
                    src={s.imageUrl}
                    alt={`${s.name} storefront`}
                    width={800}
                    height={420}
                    sizes="(max-width: 760px) 100vw, 540px"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Link>
              ) : null}
              <div className="location-card-meta">
                <div className="eyebrow">{s.area}</div>
                <h2 className="location-card-name">
                  <Link href={`/pages/${s.handle}`}>{s.name}</Link>
                </h2>
                <ShowroomOpenStatus showroom={s} />
                <address className="location-card-addr">
                  <div>{s.street}</div>
                  <div>{s.city}, {s.region} {s.postalCode}</div>
                  {s.crossStreet ? <div className="muted" style={{ fontSize: 13, marginTop: 'var(--s-1)' }}>Near {s.crossStreet}</div> : null}
                </address>
                <div className="location-card-hours muted" style={{ fontSize: 13 }}>
                  {summarizeHours(s.hours)}
                </div>
                {s.nearbyAreas.length > 0 ? (
                  <div className="location-card-areas muted" style={{ fontSize: 13, marginTop: 'var(--s-2)' }}>
                    Serving {s.nearbyAreas.slice(0, 3).join(', ')}
                    {s.nearbyAreas.length > 3 ? ` + ${s.nearbyAreas.length - 3} more` : ''}
                  </div>
                ) : null}
                <div className="location-card-actions">
                  <a
                    href={`tel:${s.phone}`}
                    className="location-card-phone tnum"
                    aria-label={`Call ${s.name} at ${formatPhone(s.phone)}`}
                  >
                    <Icon name="phone" size={14} /> {formatPhone(s.phone)}
                  </a>
                  <Link href={`/pages/${s.handle}`} className="link-arrow">
                    Store details <Icon name="arrow-right" size={14} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* Below-grid copy: long-form local intent + cross-links. The
            merchant's original 31KB Hydrogen-theme CMS body doesn't render
            (CSS classes don't exist in this storefront); replacing the most
            valuable parts here as native components so the page still
            answers "why visit a showroom" and links to ranking surfaces. */}
        <section className="section" style={{ marginTop: 'var(--s-7)' }}>
          <h2 className="h2">Why visit a showroom?</h2>
          <p className="muted" style={{ maxWidth: '60ch' }}>
            A 10-minute showroom test tells you more than a hundred online reviews. Lie down on the bed for real, compare three or four options back-to-back, and walk out the same day with free delivery scheduled. Our sleep consultants are <strong>salaried, never commission</strong> — there&rsquo;s no upsell pressure to talk you into a bed your body doesn&rsquo;t agree with.
          </p>
          <ul style={{ marginTop: 'var(--s-4)', maxWidth: '60ch', paddingLeft: 'var(--s-5)' }}>
            <li style={{ marginBottom: 'var(--s-2)' }}>Every mattress on the floor at all five showrooms — Tempur-Pedic, Stearns &amp; Foster, Sealy, Chattam &amp; Wells, Spring Air, Diamond, Englander, Eastman House, Helix, Harvest.</li>
            <li style={{ marginBottom: 'var(--s-2)' }}>Same-day white-glove delivery anywhere in LA when you order by 4 PM.</li>
            <li style={{ marginBottom: 'var(--s-2)' }}><Link href="/pages/love-your-bed-guarantee">120-night comfort exchange</Link> — sleep on it, swap it if it isn&rsquo;t right.</li>
            <li style={{ marginBottom: 'var(--s-2)' }}><Link href="/pages/mattress-store-financing">0% APR financing</Link> through Synchrony or Acima, instant approval at any location.</li>
          </ul>
        </section>

        <section className="section" style={{ marginTop: 'var(--s-6)' }}>
          <h2 className="h2">Not sure where to start?</h2>
          <p className="muted" style={{ maxWidth: '60ch' }}>
            Take our <Link href="/sleep-quiz">2-minute sleep quiz</Link> for a category recommendation, then come into the closest showroom to lie on the top picks. Or call us at{' '}
            <a href={`tel:${SITE_PHONE_TEL}`} className="tnum">{SITE_PHONE_DISPLAY}</a> — we&rsquo;ll help you pick over the phone and book delivery the same day.
          </p>
        </section>

        {/* SEMrush 20260521_1: surface the LA-pillar articles from the
            locations index — high-PageRank page that previously had no
            outbound link to the new buying guides. Pulls each pillar
            ~one click closer to root. */}
        <section className="section" style={{ marginTop: 'var(--s-6)' }}>
          <h2 className="h2">Read before you visit</h2>
          <ul style={{ maxWidth: '60ch', paddingLeft: 'var(--s-5)' }}>
            <li style={{ marginBottom: 'var(--s-2)' }}>
              <Link href="/blogs/mattress-buying-guide/best-mattress-los-angeles">Best mattress in Los Angeles (2026 guide)</Link>
              {' '}— a tour of the brands and price tiers we stock and who they fit.
            </li>
            <li style={{ marginBottom: 'var(--s-2)' }}>
              <Link href="/blogs/mattress-buying-guide/mattress-store-near-me-los-angeles">Mattress store near me — LA showrooms guide</Link>
              {' '}— which showroom matches which LA neighborhood.
            </li>
            <li style={{ marginBottom: 'var(--s-2)' }}>
              <Link href="/blogs/mattress-buying-guide/mattress-financing-options-los-angeles">LA mattress financing — 0% APR options</Link>
              {' '}— Synchrony, Acima, Affirm/Klarna alternatives, and lay-away math.
            </li>
            <li style={{ marginBottom: 'var(--s-2)' }}>
              <Link href="/blogs/mattress-buying-guide/how-to-choose-a-mattress">How to choose a mattress</Link>
              {' '}— our showroom-tested decision framework by sleep style.
            </li>
          </ul>
        </section>
      </article>
    </main>
  );
}

function ShowroomPage({
  page,
  showroom,
}: {
  page: NonNullable<Awaited<ReturnType<typeof getPageByHandle>>>;
  showroom: Showroom;
}) {
  const mapEmbedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(
    `${showroom.street}, ${showroom.city}, ${showroom.region} ${showroom.postalCode}`,
  )}&z=15&output=embed`;

  return (
    <main className="container">
      <article className="showroom-page" style={{ padding: 'var(--s-7) 0 var(--s-9)' }}>
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          <Link href="/pages/mattress-store-locations">Stores</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span>{showroom.area}</span>
        </nav>

        <header className="showroom-page-hero">
          <div className="eyebrow">{showroom.area} · Los Angeles</div>
          <h1 className="h1">{toSentenceCase(stripBrandSuffix(page.title))}</h1>
          <ShowroomOpenStatus showroom={showroom} />
          <p className="lp-hero-lede" style={{ maxWidth: '60ch' }}>
            Visit our {showroom.area} showroom — try every mattress, talk with our local team, and walk out the same day with free white-glove delivery on most beds.
          </p>
        </header>

        {showroom.imageUrl ? (
          <div className="showroom-photo">
            <Image
              src={showroom.imageUrl}
              alt={`${showroom.name} storefront`}
              width={1600}
              height={900}
              sizes="(max-width: 1024px) 100vw, 1080px"
              priority
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ) : null}

        <section className="showroom-page-grid">
          <aside className="showroom-info-card">
            <div className="eyebrow">Visit us</div>
            <address className="showroom-info-addr">
              <div>{showroom.street}</div>
              <div>{showroom.city}, {showroom.region} {showroom.postalCode}</div>
            </address>
            <a href={`tel:${showroom.phone.replace(/[^+\d]/g, '')}`} className="showroom-info-phone">
              <Icon name="phone" size={14} /> {formatPhone(showroom.phone)}
            </a>
            <ul className="showroom-info-hours">
              {showroom.hours.map((h) => (
                <li key={h.day}>
                  <span>{h.day}</span>
                  <span className="tnum">{formatHour(h.open)}&ndash;{formatHour(h.close)}</span>
                </li>
              ))}
            </ul>
            <div className="showroom-info-cta">
              <a href={showroom.mapUrl} target="_blank" rel="noopener" className="btn btn-primary">
                Get directions <Icon name="arrow-up-right" size={14} />
              </a>
              <Link href="/pages/mattress-store-financing" className="btn btn-ghost">
                Financing options
              </Link>
            </div>
            <div className="showroom-info-meta">
              <span><Icon name="truck" size={14} /> Free delivery within LA</span>
              <span><Icon name="shield" size={14} /> 120-night exchange</span>
              <span><Icon name="card" size={14} /> 0% APR financing</span>
            </div>
          </aside>

          <div className="showroom-page-body">
            <div className="showroom-map">
              <iframe
                title={`Map of ${showroom.name}`}
                src={mapEmbedSrc}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </section>

        <ShowroomDetail showroom={showroom} cmsBody={page.body ?? null} />

        <section className="section">
          <div className="eyebrow">Other LA showrooms</div>
          <h2 className="h2">Five locations across Los Angeles</h2>
          <p className="muted" style={{ maxWidth: '60ch', marginBottom: 'var(--s-5)' }}>
            See all five showrooms, hours, and directions on our{' '}
            <Link href="/pages/mattress-store-locations" className="link-arrow">
              full locations page <Icon name="arrow-right" size={14} />
            </Link>.
          </p>
        </section>
      </article>
    </main>
  );
}

function formatHour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(h)) return hhmm;
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = ((h + 11) % 12) + 1;
  return m ? `${h12}:${String(m).padStart(2, '0')}${ampm}` : `${h12}${ampm}`;
}

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
 */
const SALE_CATEGORY_CHIPS = [
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
 * Build the SaleEvent + AggregateOffer JSON-LD that anchors the sale
 * page in Google's events / sale-rich-result graph.
 *
 * Only emitted when `custom.sale_starts_at` is populated on the page —
 * older sale pages without the metafield render without this LD (and
 * keep the generic WebPage LD that layout.tsx emits).
 *
 * eventStatus transitions automatically: `EventScheduled` until the
 * window opens, `EventScheduled` (active) inside, and downgraded to a
 * past-event marker once the window closes so search engines don't
 * misrepresent a stale page as currently active.
 */
function buildSaleEventLd(
  page: NonNullable<Awaited<ReturnType<typeof getPageByHandle>>>,
  featuredProducts: ProductSummary[],
  onSaleCount: number,
  saleHasEnded: boolean,
): Record<string, unknown> | null {
  if (!page.saleStartsAt) return null;
  const cleanTitle = toSentenceCase(stripBrandSuffix(page.title));
  const url = `${SITE}/pages/${page.handle}`;
  const description = firstNonEmpty(page.seo.description, page.bodySummary, undefined) || undefined;

  // Aggregate price range across the curated/on-sale featured products.
  // Falls back to a wide store-wide range when featuredProducts is empty
  // (no curated collection yet) so the schema still validates.
  const priceAmounts = featuredProducts
    .flatMap((p) => [Number.parseFloat(p.priceRange.minVariantPrice.amount), Number.parseFloat(p.priceRange.maxVariantPrice.amount)])
    .filter((n) => Number.isFinite(n) && n > 0);
  const lowPrice = priceAmounts.length ? Math.min(...priceAmounts) : 199;
  const highPrice = priceAmounts.length ? Math.max(...priceAmounts) : 8999;

  return {
    '@context': 'https://schema.org',
    '@type': 'SaleEvent',
    '@id': `${url}#sale-event`,
    name: cleanTitle,
    ...(description ? { description } : {}),
    url,
    startDate: page.saleStartsAt,
    ...(page.saleEndsAt ? { endDate: page.saleEndsAt } : {}),
    eventStatus: saleHasEnded
      ? 'https://schema.org/EventPostponed'
      : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    organizer: { '@id': `${SITE}/#organization` },
    location: SHOWROOMS.map((s) => ({
      '@type': 'FurnitureStore',
      name: s.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: s.street,
        addressLocality: s.city,
        addressRegion: s.region,
        postalCode: s.postalCode,
        addressCountry: 'US',
      },
    })),
    offers: {
      '@type': 'AggregateOffer',
      url,
      priceCurrency: 'USD',
      lowPrice: lowPrice.toFixed(2),
      highPrice: highPrice.toFixed(2),
      offerCount: onSaleCount || featuredProducts.length || 1,
      availability: 'https://schema.org/InStock',
    },
  };
}

function SalePage({
  page,
  featuredProducts,
  onSaleCount,
}: {
  page: NonNullable<Awaited<ReturnType<typeof getPageByHandle>>>;
  featuredProducts: ProductSummary[];
  onSaleCount: number;
}) {
  const cleanTitle = toSentenceCase(stripBrandSuffix(page.title));
  // Once `custom.sale_ends_at` is in the past, the page stays live (good
  // for evergreen "what is the X sale" search intent) but flips into an
  // "ended" mode: a banner explains the sale closed and points to
  // current offers, and the SaleEvent JSON-LD downgrades eventStatus.
  // Keeping the URL indexable beats 404'ing after the event — emails
  // sent during the sale keep working as archive links.
  const saleEndedAt = page.saleEndsAt ? Date.parse(page.saleEndsAt) : NaN;
  const saleHasEnded = Number.isFinite(saleEndedAt) && Date.now() > saleEndedAt;
  const saleEventLd = buildSaleEventLd(page, featuredProducts, onSaleCount, saleHasEnded);

  return (
    <main>
      {saleEventLd ? (
        <script
          type="application/ld+json"
          // SaleEvent / AggregateOffer JSON-LD. Emitted from the page
          // (not the layout) because only the page handler has the
          // resolved featuredProducts + onSaleCount that feed
          // lowPrice / highPrice / offerCount.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(saleEventLd) }}
        />
      ) : null}
      <header className="sale-page-hero">
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
              This event has ended. The brands featured here are usually included in our next sale — check current offers below, or call us at{' '}
              <a href={`tel:${SITE_PHONE_TEL}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{SITE_PHONE_DISPLAY}</a>{' '}
              for early access to upcoming markdowns.
            </p>
          ) : page.bodySummary ? (
            <p className="sale-page-lede">{page.bodySummary}</p>
          ) : null}
          <div className="sale-page-ctas">
            <Link href="/collections/on-sale" className="btn btn-lg btn-on-dark">
              {saleHasEnded ? 'See current offers' : 'Shop the Sale'} <Icon name="arrow-right" size={16} />
            </Link>
            <Link href="/pages/mattress-store-locations" className="btn btn-lg btn-ghost-on-dark">
              Find a showroom
            </Link>
          </div>
        </div>
      </header>

      {/* Trust strip — same trio used by the homepage TrustBar. Visible
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

      {/* Featured product grid — first 12 best-sellers from the on-sale
          collection. Same PlpCard component every other PLP uses, so
          the look stays consistent and shoppers see real product cards
          with prices, ratings, brand tags, etc. */}
      {featuredProducts.length > 0 ? (
        <section className="sale-page-grid-section" aria-labelledby="sale-grid-h">
          <div className="container">
            <header className="sale-page-grid-head">
              <h2 id="sale-grid-h" className="h2">Featured deals</h2>
              <p className="muted">A few of our best-selling mattresses currently on sale. {onSaleCount > 12 ? `${onSaleCount}+ models discounted in total — see all below.` : null}</p>
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
              <Link href="/collections/on-sale" className="btn btn-primary btn-lg">
                See every mattress on sale <Icon name="arrow-right" size={16} />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* Merchant-authored long-form body. Sale terms, brand callouts,
          showroom hours, etc. — anything they type into the Shopify
          page body renders here. */}
      {page.body ? (
        <article className="container sale-page-body">
          <div className="rte cms-body" dangerouslySetInnerHTML={{ __html: autoLinkArticleBody(sanitizeShopifyHtml(page.body)) }} />
        </article>
      ) : null}

      {/* Footer CTA — repeat the primary action at the end of the page
          so a shopper who scrolled all the way down doesn't have to
          scroll back up to convert. */}
      <section className="sale-page-foot-cta">
        <div className="container sale-page-foot-cta-inner">
          <h2 className="h2">Ready to upgrade your sleep?</h2>
          <p className="muted">Free LA delivery, 0% APR financing, 120-night exchange. Every mattress on the floor at all 5 showrooms.</p>
          <div className="sale-page-ctas">
            <Link href="/collections/on-sale" className="btn btn-primary btn-lg">
              Shop the Sale <Icon name="arrow-right" size={16} />
            </Link>
            <Link href="/sleep-quiz" className="btn btn-ghost btn-lg">
              Take the 2-min quiz
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/**
 * Phase 277e: LA-neighborhood page template (Beverly Hills, Santa Monica,
 * DTLA, Pasadena, Burbank, Sherman Oaks, Hollywood, Long Beach). Each
 * page targets "mattress store {neighborhood}" search intent without
 * pretending to be a physical store of its own — there's no address,
 * no own hours, no map embed. Instead, the page positions the 1–2
 * nearest physical showrooms with drive-time context and a clear
 * "Visit our nearest showroom" CTA.
 *
 * Renders only when the merchant has created a Shopify Page with one
 * of the handles defined in lib/neighborhoods.ts NEIGHBORHOODS. If the
 * Shopify page body is empty, the neighborhood's `defaultBlurb` fills
 * in (≥150 words to avoid thin-content flags).
 *
 * Schema: FurnitureStore with `areaServed` set to the neighborhood
 * (not `address` — see lib/neighborhoods.ts comments) and `department`
 * listing the nearest physical showrooms so Google can still see the
 * real stores behind this landing page.
 */
function NeighborhoodPage({
  page,
  neighborhood,
}: {
  page: NonNullable<Awaited<ReturnType<typeof getPageByHandle>>>;
  neighborhood: Neighborhood;
}) {
  const nearest = getNearestShowrooms(neighborhood);
  const primaryShowroom = nearest[0]; // first listed is the "primary" CTA

  return (
    <main className="container">
      <article className="cms-page" style={{ padding: 'var(--s-7) 0 var(--s-9)' }}>
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          <Link href="/pages/mattress-store-locations">Stores</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span>{neighborhood.name}</span>
        </nav>

        <header className="showroom-page-hero">
          <div className="eyebrow">{neighborhood.name} · Los Angeles</div>
          {/* Phase 292 (cowork MEDIUM#6/#7): build the H1 from the
              proper-cased neighborhood.name + ", Los Angeles" instead of
              toSentenceCase(page.title). The old path lowercased the
              neighborhood ("Mattress store in burbank") and dropped any
              LA reference. Skip the ", Los Angeles" suffix when the name
              already contains "LA" (Downtown LA) to avoid "… LA, Los
              Angeles". Still differs from <title> case-normalized
              ("… | LA Mattress"), so no duplicate-H1/title regression. */}
          <h1 className="h1">
            {`Mattress store in ${neighborhood.name}`}
            {/\bLA\b/.test(neighborhood.name) ? '' : ', Los Angeles'}
          </h1>
          <p className="lp-hero-lede" style={{ maxWidth: '60ch' }}>
            Free white-glove delivery to {neighborhood.name} on orders over $499 — same-day if you order by 4pm.{' '}
            {primaryShowroom
              ? `Visit our ${primaryShowroom.area} showroom to try every mattress in person.`
              : 'Visit any of our 5 LA showrooms to try every mattress in person.'}
          </p>
        </header>

        {page.body ? (
          <div
            className="rte cms-body"
            style={{ marginTop: 'var(--s-5)' }}
            dangerouslySetInnerHTML={{ __html: autoLinkArticleBody(sanitizeShopifyHtml(page.body)) }}
          />
        ) : (
          <div className="rte cms-body" style={{ marginTop: 'var(--s-5)' }}>
            <p>{neighborhood.defaultBlurb}</p>
          </div>
        )}

        {nearest.length > 0 ? (
          <section className="section" style={{ marginTop: 'var(--s-7)' }}>
            <div className="eyebrow">Nearest showrooms</div>
            <h2 className="h2">
              {nearest.length === 1
                ? `Visit our ${nearest[0].area} mattress store`
                : `Two showrooms near ${neighborhood.name}`}
            </h2>
            <div className="nf-grid" style={{ marginTop: 'var(--s-5)' }}>
              {nearest.map((s) => (
                <Link key={s.handle} href={`/pages/${s.handle}`} className="nf-tile">
                  <div className="nf-tile-label">{s.name}</div>
                  <div className="nf-tile-sub muted">
                    {s.street}, {s.city} · {formatPhone(s.phone)}
                  </div>
                  <Icon name="arrow-right" size={16} />
                </Link>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 'var(--s-5)', maxWidth: '60ch' }}>
              Prefer to see all 5 showrooms?{' '}
              <Link href="/pages/mattress-store-locations" className="link-arrow">
                View every Los Angeles location <Icon name="arrow-right" size={14} />
              </Link>
              .
            </p>
          </section>
        ) : null}

        <section className="section" style={{ marginTop: 'var(--s-7)' }}>
          <div className="eyebrow">Skip the drive</div>
          <h2 className="h2">Take the 2-minute sleep quiz</h2>
          <p className="muted" style={{ maxWidth: '60ch' }}>
            Eight questions, one recommendation. We&rsquo;ll match you to a mattress, then deliver it free anywhere in LA.
          </p>
          <div style={{ marginTop: 'var(--s-4)' }}>
            <Link href="/sleep-quiz" className="btn btn-primary">
              Start the quiz <Icon name="arrow-right" size={14} />
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
