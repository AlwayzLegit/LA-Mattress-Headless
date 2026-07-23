import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getPageByHandle, getCollectionByHandle } from '@/lib/shopify';
import { publishedPages } from '@/lib/inventory';
import { findShowroom } from '@/lib/showrooms';
import { findNeighborhood, NEIGHBORHOODS } from '@/lib/neighborhoods';
import { truncDescription, firstNonEmpty, stripBrandSuffix, ensureTitleDistinctFromH1 } from '@/lib/seo';
import { isSalePage } from '@/lib/page-jsonld';
import { isCodedPage, codedPageMeta, CODED_PAGE_HANDLES } from '@/lib/coded-pages';
import { isPreviewEnabled } from '@/lib/preview-auth-cookie';
import { FaqPage } from '@/app/_components/sections/faq-page';
import { PriceConfidencePage } from '@/app/_components/sections/price-confidence';
import { ReviewsPage } from '@/app/_components/sections/reviews-page';
import { DataOptOutPage } from '@/app/_components/sections/data-opt-out-page';
import { ServicePage } from '@/app/_components/sections/service-page';
import { FinancingExtras } from '@/app/_components/sections/financing-extras';
import { DeliveryExtras } from '@/app/_components/sections/delivery-extras';
import { GuaranteeExtras } from '@/app/_components/sections/guarantee-extras';
import { isServicePage, SERVICE_PAGES } from '@/lib/service-pages';
import { ComparisonPage } from '@/app/_components/sections/comparison-page';
import { isComparisonPage, COMPARISON_PAGES } from '@/lib/comparison-pages';
import { GuidePage } from '@/app/_components/sections/guide-page';
import { isGuidePage, GUIDE_PAGES } from '@/lib/guide-pages';
import { MattressSizesPage } from '@/app/_components/sections/mattress-sizes-page';
import { MattressTypesPage } from '@/app/_components/sections/mattress-types-page';
import { LegalPage } from '@/app/_components/sections/legal-page';
import { isLegalPage, LEGAL_PAGES } from '@/lib/legal-pages';
import { ContactPage } from '@/app/_components/sections/contact-page';
import { ShowroomPage } from '@/app/_components/sections/showroom-page';
import { LocationsIndexPage } from '@/app/_components/sections/locations-index-page';
import { SalePage } from '@/app/_components/sections/sale-page';
import { NeighborhoodPage } from '@/app/_components/sections/neighborhood-page';
import { DefaultPage } from '@/app/_components/sections/default-cms-page';

type Params = {
  params: Promise<{ handle: string }>;
};

// 6h ISR window for CMS pages (locations, showrooms, financing,
// returns, FAQ, sale pages). Pages change less often than 10min
// but more often than blog articles — showroom hours, sale-page
// promos, FAQ updates. No `pages/update` webhook exists in
// Shopify's Admin UI (REST-only or via Shopify Flow), so the
// revalidate window is the main natural invalidation lever for
// page-body edits. Lowered 6h → 1h so edits (and code/section
// changes like the locations map) surface within the hour without a
// manual flush, matching the rest of the site's ~1h cadence.
export const revalidate = 3600;
export const dynamicParams = true;

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);

export function generateStaticParams() {
  if (!SHOPIFY_CONFIGURED) return [];
  // `reviews` / `data-sharing-opt-out` are isPublished CMS pages AND
  // coded handles — filter coded handles out of the published-pages map
  // so each param is emitted exactly once (no duplicate static params).
  // Dedupe across published CMS pages, coded handles, and the code-driven
  // neighborhood landing pages (lib/neighborhoods.ts). Neighborhoods are
  // added explicitly so newly-created areas prerender even before the daily
  // url-inventory snapshot picks up their Shopify page.
  const handles = new Set<string>();
  for (const p of publishedPages) if (!isCodedPage(p.handle)) handles.add(p.handle);
  for (const h of CODED_PAGE_HANDLES) handles.add(h);
  for (const n of NEIGHBORHOODS) handles.add(n.handle);
  return [...handles].map((handle) => ({ handle }));
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
  // Read the preview cookie only AFTER the page is known to exist:
  // cookies() marks the whole render dynamic, and a dynamic render
  // that then throws notFound() ships Next's empty __next_error__
  // shell instead of the prerendered branded 404 (audit
  // seo-tech-04/ux-404-07/a11y-404-03). Unknown handles — the common
  // case, via stale external links — must 404 without ever touching a
  // dynamic API.
  const isPreview = await isPreviewEnabled();
  // Mirror the SalePage storefront date gate: when `custom.available_at`
  // is in the future, hide metadata so the pre-launch URL isn't indexed
  // or shared with rich SEO data before the sale goes live. Preview
  // token bypasses the gate; preview URLs explicitly request noindex
  // below so the previewer page never accidentally leaks to crawlers.
  if (isSalePage(page.handle) && page.availableAt && !isPreview) {
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
  // SEO is Shopify-owned: page.seo.title comes from the merchant's
  // Admin SEO field (global.title_tag) — the SEMrush-tuned values were
  // migrated there in the Phase 2 SEO-ownership migration that retired
  // lib/page-seo-overrides.ts. ensureTitleDistinctFromH1 stays as
  // render-time normalization (keeps <title> distinct from the H1).
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
  // Neighborhood pages (lib/neighborhoods.ts) render the curated
  // `defaultBlurb` as their body when the Shopify Page body is empty —
  // but bodySummary is empty in that case, so without this the meta
  // description would collapse to the weak "<title> — LA Mattress Store"
  // boilerplate. Slot the neighborhood blurb into the fallback chain
  // (after any merchant-authored seo.description / body) so every
  // areaServed page gets a real, location-specific description.
  const neighborhood = findNeighborhood(page.handle);
  const description = truncDescription(
    firstNonEmpty(
      page.seo.description,
      page.bodySummary,
      neighborhood?.defaultBlurb,
      `${page.title}, LA Mattress Store`,
    ),
  );
  const url = `/pages/${page.handle}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    // Preview-token bypass: hard-noindex the preview URL so a crawler
    // that stumbles onto a shared preview link never adds it to the
    // index ahead of the real sale launch. Public (non-preview) URLs
    // inherit the default robots policy from the layout.
    ...(isPreview ? { robots: { index: false, follow: false } } : {}),
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
  // Upstream failures (ShopifyApiError) must propagate to the error
  // boundary — swallowing them into notFound() serves a 404 that ISR then
  // caches for the whole revalidate window. SEMrush 2026-07-17: one blip
  // during regeneration of a footer-linked showroom page fanned into 1,318
  // broken-internal-link flags. `null` means Shopify genuinely has no such
  // page → real 404. Same rule on the PDP/PLP/article/blog routes.
  const page = await getPageByHandle(params.handle);
  if (!page) notFound();
  // Preview cookie read deliberately AFTER the notFound() gate — see
  // the matching note in generateMetadata (404s must stay static).
  const isPreview = await isPreviewEnabled();

  const showroom = findShowroom(page.handle);
  if (showroom) return <ShowroomPage page={page} showroom={showroom} />;
  if (page.handle === 'mattress-store-locations') return <LocationsIndexPage page={page} />;
  // Contact page gets a dedicated template (tappable call/email/visit
  // action cards + all-five-showroom map) on top of the shared service-
  // page chrome. Reuses the existing ServicePageConfig for this handle.
  // Checked before the generic service-page dispatch below.
  if (page.handle === 'mattress-store-contact') {
    return <ContactPage page={page} config={SERVICE_PAGES['mattress-store-contact']} />;
  }
  // "Confidence" service pages (financing / warranty / comfort-exchange /
  // delivery) share a brand-level template chrome — hero + trust
  // strip + sticky TOC + CTA — while their merchant-authored CMS bodies
  // stay editable in Shopify Admin. Config lives in lib/service-pages.ts.
  if (isServicePage(page.handle)) {
    // Code-controlled visual blocks via the ServicePage `extras` slot for
    // the pages that were text walls next to competitor equivalents.
    // Other service pages render as-is.
    const GUARANTEE_FLOW_HANDLES = ['love-your-bed-guarantee', 'lowest-price-guarantee', 'warranty'];
    const extras =
      page.handle === 'mattress-store-financing' ? (
        <FinancingExtras />
      ) : page.handle === 'mattress-store-delivery' ? (
        <DeliveryExtras />
      ) : GUARANTEE_FLOW_HANDLES.includes(page.handle) ? (
        <GuaranteeExtras handle={page.handle} />
      ) : undefined;
    return <ServicePage page={page} config={SERVICE_PAGES[page.handle]} extras={extras} />;
  }
  if (isSalePage(page.handle)) {
    // Storefront date gate: sale pages set `custom.available_at` to
    // (sale starts_at − 7 days) so each holiday page goes live exactly
    // a week before the event without any cron / Shopify Flow rigging.
    // When `available_at` is in the future, treat the page as 404 — the
    // page exists in Shopify but isn't yet ready for shoppers. The
    // preview-token query param bypasses the gate for staging QA.
    if (page.availableAt && !isPreview) {
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
    const usedCurated = Boolean(curated && curated.products.nodes.length > 0);
    const saleCollection = usedCurated
      ? curated
      : await getCollectionByHandle({
          handle: 'on-sale',
          first: 12,
          sortKey: 'BEST_SELLING',
        }).catch(() => null);
    const featuredProducts = saleCollection?.products.nodes ?? [];
    const onSaleCount = saleCollection?.products.nodes.length ?? 0;
    // Primary CTAs link to the same collection the grid is drawn from, so
    // "Shop the Sale" lands on the event's curated collection when it
    // exists (and is published + non-empty), else the broad on-sale set.
    const saleCollectionHref = usedCurated ? `/collections/${curatedHandle}` : '/collections/on-sale';
    return <SalePage page={page} featuredProducts={featuredProducts} onSaleCount={onSaleCount} saleCollectionHref={saleCollectionHref} isPreview={isPreview} />;
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

  // Editorial "X vs Y" comparison pages (purple-vs-tempur-pedic,
  // mattress-firm-vs-la-mattress-store) share a brand-level chrome — a
  // "VS" hero + trust strip + sticky TOC + CTA — while the merchant-
  // authored CMS body (verdict, comparison table, FAQ) stays editable in
  // Shopify Admin and gets restyled into a scannable layout. Config lives
  // in lib/comparison-pages.ts. Checked after neighborhood (none of the
  // comparison handles match a neighborhood) and before the default CMS
  // fallback.
  if (isComparisonPage(page.handle)) {
    return <ComparisonPage page={page} config={COMPARISON_PAGES[page.handle]} />;
  }

  // Phase 308 SEO audit: `/pages/mattress-sizes` gets its own
  // dedicated template that wraps GuidePage's structure with code-
  // controlled content (multi-format dimensions table, FAQ accordion,
  // FAQPage JSON-LD) targeting the 17 Semrush-flagged keyword
  // variants. Checked BEFORE the generic GuidePage so this handle
  // hits the specialized renderer; mattress-types still uses
  // GuidePage. See app/_components/sections/mattress-sizes-page.tsx
  // for the full rationale.
  if (page.handle === 'mattress-sizes') {
    return <MattressSizesPage page={page} />;
  }
  // `/pages/mattress-types`: dedicated visual template. Same rationale
  // as mattress-sizes — the merchant body is strong prose but the page
  // was nearly image-free; this renders code-controlled construction
  // cutaway diagrams + feel-rating visuals + a comparison matrix above
  // the editorial body. See app/_components/sections/mattress-types-page.tsx.
  if (page.handle === 'mattress-types') {
    return <MattressTypesPage page={page} />;
  }
  // Editorial buying-guide pages (mattress-types and any future
  // additions) share the service-page chrome but run wrapCmsTables so
  // the size chart gets the scannable .cmp-table-scroll card
  // treatment. Config lives in lib/guide-pages.ts. Checked last
  // before the plain CMS fallback.
  if (isGuidePage(page.handle)) {
    return <GuidePage page={page} config={GUIDE_PAGES[page.handle]} />;
  }

  // Policy / legal pages (terms, privacy, returns, the policy hub,
  // recycling fee) share a clean readable chrome — hero + "last updated"
  // + sticky TOC + contact footnote, no marketing trust strip. Config in
  // lib/legal-pages.ts. Checked last before the plain CMS fallback.
  if (isLegalPage(page.handle)) {
    return <LegalPage page={page} config={LEGAL_PAGES[page.handle]} />;
  }

  return <DefaultPage page={page} />;
}
