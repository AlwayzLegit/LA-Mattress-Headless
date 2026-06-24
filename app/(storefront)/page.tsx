import type { Metadata } from 'next';

import { Hero } from '../_components/hero';
import {
  ShopByCategory,
  BrandStrip,
  FeaturedGuides,
  WhyUs,
  Reviews,
} from '../_components/sections/static-sections';
import { PopularProducts } from '../_components/sections/popular-products';
import { Showrooms } from '../_components/sections/showrooms';
import { FAQ } from '../_components/sections/faq';
import { QuizLeadIn } from '../_components/sections/quiz-leadin';
import { WaysToFindMatch } from '../_components/sections/ways-to-find-match';
import { LifestyleBand } from '../_components/sections/lifestyle-band';
import { HomepageSeoContent } from '../_components/sections/homepage-seo-content';
import { RecentlyViewedRail } from '../_components/recently-viewed';
import { faqJsonLd, resolveHomepageFaq } from '@/lib/faq';
import { buildLocalBusinessLd } from '@/lib/structured-data';
import { getHomepageSeo } from '@/lib/shopify';
import { getSitewideReviewsExtension } from '@/lib/judgeme';
import { getHeroSlides, getShowrooms, getFaqItems } from '@/lib/shopify';
import { FALLBACK_SHOWROOMS } from '@/lib/showrooms';
import { FALLBACK_HERO_SLIDES } from '../_components/hero-slides';

const LOCAL_BUSINESS_ID = 'https://www.mattressstoreslosangeles.com/#localbusiness';

// Phase 308 SEO audit (Semrush 20260530): live homepage <title> +
// <meta description> were composed from Shopify Brand fields with code
// fallbacks (Phase 268 design). Semrush flagged the resulting strings
// for missing target keywords — "mattress sales" and "shop mattresses"
// absent from both title and meta description across all 4 homepage
// target keywords (8,015 priority points). The Brand-composed path
// was Phase 268's flexibility play; the SEO impact says the homepage
// is too critical to leave to a field someone may forget to refresh
// in Shopify Admin. Hard-coding here as the canonical SEO-optimal
// values. Edit via PR when the keyword strategy shifts. Shopify Brand
// still reads through for `getShopBrand()` callers elsewhere (OG card,
// LocalBusiness JSON-LD), so this only overrides the homepage tag
// strings, not the brand identity itself.
//
// Keyword targets (Semrush 20260624): "mattress store" (49.5k),
// "mattress sale" (22.2k), "same day mattress delivery" (2.4k),
// "mattress los angeles" (1k), "mattress store los angeles" (320).
// Title:    67 chars (under the ~70 SERP truncation threshold). Leads
//           with "Mattress Store Los Angeles", then "Sales" +
//           "Same-Day Delivery", then the "LA Mattress" brand.
// Meta:    ~142 chars (under the ~155 SERP truncation threshold). Opens
//           with the "LA Mattress Store" brand, then "mattress sales" +
//           "Los Angeles" + the "same-day LA delivery" differentiator
//           and "120-night exchange" trust cue that lift local CTR.
// Last-resort fallbacks ONLY. Homepage SEO is now merchant-owned in
// Shopify Admin → Content → Metaobjects → Homepage SEO (read via
// getHomepageSeo). These constants render only if that metaobject is
// missing/empty or the Storefront fetch fails, so the homepage never
// ships blank metadata. Keep them keyword-tuned as a safe default.
const FALLBACK_TITLE =
  'Mattress Store Los Angeles — Sales & Same-Day Delivery | LA Mattress';
const FALLBACK_DESCRIPTION =
  'LA Mattress Store — shop mattress sales in Los Angeles on Tempur-Pedic, ' +
  'Stearns & Foster, Helix & more. Free same-day LA delivery + 120-night exchange.';

export async function generateMetadata(): Promise<Metadata> {
  // Source of truth: the homepage_seo metaobject (merchant-editable in
  // Admin). Falls back to the constants above on miss/error.
  const seo = await getHomepageSeo();
  const title = seo?.title || FALLBACK_TITLE;
  const description = seo?.description || FALLBACK_DESCRIPTION;
  return {
    // `absolute` so the root layout's "%s · LA Mattress Store" template
    // can't re-append the brand a third time (cowork LOW#12).
    title: { absolute: title },
    description,
    alternates: { canonical: 'https://www.mattressstoreslosangeles.com/' },
    // Only override the layout's OG image when the merchant set one on the
    // metaobject; otherwise inherit the sitewide brand cover image.
    ...(seo?.ogImage ? { openGraph: { images: [{ url: seo.ogImage }] } } : {}),
  };
}

// Site-wide Organization / LocalBusiness / WebSite JSON-LD lives in app/layout.tsx
// and emits on every page. Per-template structured data (Product, CollectionPage,
// BlogPosting, etc.) is emitted by each route's page.tsx.

// 5-minute ISR. The homepage had no page-level revalidate, so its static HTML
// only regenerated on a rebuild or an explicit revalidatePath('/') — which
// meant content/section changes (hero, brands, reviews, why-us, etc.) didn't
// surface without a manual flush.
//
// Window is 5 min (was 1h) so homepage SEO edits — the title/description in
// the `homepage_seo` metaobject, read by generateMetadata() above — go live
// within ~5 min. That metaobject can't be webhook-busted: Shopify's
// Settings → Notifications UI exposes no metaobject topics, and creating the
// subscription via a managed connector's API yields a non-retrievable signing
// secret (see app/api/revalidate/route.ts). The short ISR window is the
// no-webhook path to fast propagation. Each homepage section fetch sets its
// own revalidate in the query layer, so this only affects regen cadence of
// the static HTML, not per-section Shopify API call volume. Collection/product
// edits still bust instantly via the /api/revalidate webhook (which also
// revalidates '/').
export const revalidate = 300;

export default async function Home() {
  // Phase 267: hero slides come from `hero_slide` Shopify metaobjects
  // when the merchant has created them; otherwise we fall back to the
  // 3-slide constant so the page is never empty-handed. The Shopify
  // path also moves the bg images onto Shopify CDN (preconnected +
  // edge-cached) instead of Unsplash.
  // Phase 299: also pull the sitewide reviews extension in parallel —
  // brings AggregateRating + top reviews into the homepage
  // LocalBusiness schema, eligible for the brand review snippet in
  // SERP. Returns null when Judge.me is unconfigured; we fall through
  // to the un-enriched LOCAL_BUSINESS_LD without surfacing an error.
  const [shopifySlides, reviewsExtension, liveShowrooms, liveFaq] = await Promise.all([
    getHeroSlides(),
    getSitewideReviewsExtension(LOCAL_BUSINESS_ID),
    getShowrooms(),
    getFaqItems(),
  ]);
  // Live FAQ for the homepage JSON-LD — same subset rendered by
  // <FAQ />, so the structured data and the visible accordion stay in
  // lock-step. Falls back to the static constant on empty.
  const homepageFaq = resolveHomepageFaq(liveFaq);
  const slides = shopifySlides.length > 0 ? shopifySlides : FALLBACK_HERO_SLIDES;
  // Live showrooms feed the sitewide LocalBusiness JSON-LD — merchant
  // edits to hours / phones / addresses in Shopify Admin → Metaobjects →
  // Showroom propagate within one ISR cycle. Falls back to the static
  // showroom snapshot if Shopify is unreachable so the homepage never
  // emits an empty department[] array.
  const showrooms = liveShowrooms.length > 0 ? liveShowrooms : FALLBACK_SHOWROOMS;
  const baseLocalBusinessLd = buildLocalBusinessLd(showrooms);
  const localBusinessLd = reviewsExtension
    ? { ...baseLocalBusinessLd, ...reviewsExtension }
    : baseLocalBusinessLd;

  return (
    <main>
      {/* Phase 308 SEO PR C: canonical homepage <h1>. Visually hidden
          (.sr-only) so the visual hierarchy is unchanged — hero slide 0
          still reads as the prominent title to a sighted shopper — but
          screen readers + search engines see this as the page's primary
          heading. Carries all four homepage target keywords Semrush
          flagged as missing from the previous slide-0-based <h1>
          (mattress store, los angeles, shop mattresses, mattress sales).
          Keep this string in sync with the canonical <title> + meta
          description in generateMetadata() above. */}
      <h1 className="sr-only">Mattress Store Los Angeles &mdash; Shop Mattresses, Mattress Sales &amp; Same-Day Delivery</h1>
      <Hero slides={slides} />
      {/* Quiz lead-in sits directly under the hero so the first
          interactive surface on the homepage is the "find your match"
          path. Pre-fills /sleep-quiz?position=<id> on tap, dropping
          the shopper at Q2 — sunk-cost commitment that lifts quiz
          completion vs. a cold start. Industry-standard placement
          (Helix, Casper, Nectar all put it above the fold). */}
      <QuizLeadIn />
      <PopularProducts />
      {/* RecentlyViewedRail must sit AFTER an above-fold server-rendered
          section, not directly under the hero. It's a client component
          that returns null pre-hydration and pops in a full ~400px-tall
          section once it reads localStorage. With it placed under the
          hero, the post-hydration pop-in pushed every subsequent
          section down within the visible viewport — PostHog web-vitals
          captured a homepage CLS p95 of 0.79 (severe, sourced from the
          ~5% of returning visitors with 2+ recently-viewed items).
          Demoting it below PopularProducts moves the shift below the
          fold for typical viewports (Hero ~700px + QuizLeadIn ~180px +
          PopularProducts ~600px places the rail past 1400px down), so
          hydration completes before the user scrolls to where the
          shift happens. The "Welcome back" eyebrow still surfaces for
          returning visitors, just after Popular Products instead of
          before. */}
      <RecentlyViewedRail heading="Welcome back" eyebrow="Pick up where you left off" />
      <ShopByCategory />
      <Showrooms />
      <BrandStrip />
      <FeaturedGuides />
      <WhyUs />
      {/* #13: full-bleed lifestyle band to break up the text-dense middle. */}
      <LifestyleBand />
      {/* Three discovery paths: quiz / chat / showroom. Replaces the
          old QuizTeaser, which was a single-CTA repeat of what the
          QuizLeadIn already shows above the fold. */}
      <WaysToFindMatch />
      {/* Phase 308 SEO PR B: keyword-rich prose block that clears the
          Semrush homepage flags for `body_missing_kw` ("mattress sales"),
          `low_word_count`, `missing_related_words` ("twin xl",
          "mattress online"), and `low_readability`. Placed here, well
          below the fold, so it doesn't compete with the hero/quiz
          funnel above and doesn't affect LCP. See
          app/_components/sections/homepage-seo-content.tsx for the
          per-paragraph rationale. */}
      <HomepageSeoContent />
      <Reviews />
      <FAQ />
      <script
        id="ld-faq-home"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(homepageFaq)) }}
      />
      <script
        id="ld-localbusiness-home"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessLd) }}
      />
    </main>
  );
}
