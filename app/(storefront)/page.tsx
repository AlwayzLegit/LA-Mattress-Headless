import type { Metadata } from 'next';

import { Hero } from '../_components/hero';
import {
  ShopByCategory,
  BrandStrip,
  FeaturedGuides,
  WhyUs,
  QuizTeaser,
  Reviews,
} from '../_components/sections/static-sections';
import { PopularProducts } from '../_components/sections/popular-products';
import { Showrooms } from '../_components/sections/showrooms';
import { FAQ } from '../_components/sections/faq';
import { RecentlyViewedRail } from '../_components/recently-viewed';
import { faqJsonLd } from '@/lib/faq';
import { composeBrandTitle } from '@/lib/seo';
import { LOCAL_BUSINESS_LD } from '@/lib/structured-data';
import { getSitewideReviewsExtension } from '@/lib/judgeme';
import { getShopBrand, getHeroSlides } from '@/lib/shopify';
import { FALLBACK_HERO_SLIDES } from '../_components/hero-slides';

const LOCAL_BUSINESS_ID = 'https://www.mattressstoreslosangeles.com/#localbusiness';

// Phase 268: homepage title + description now read from Shopify Brand
// (Settings → Store details → Brand) when available, with hardcoded
// fallbacks for unconfigured stores or empty Brand fields.
const FALLBACK_TITLE = 'Mattress Store in Los Angeles | LA Mattress — 5 Showrooms';
const FALLBACK_DESCRIPTION =
  'Family-owned Los Angeles mattress store with 5 showrooms — Koreatown, West LA, Hancock Park, Studio City & Glendale. Shop Tempur-Pedic, Stearns & Foster, Helix & Diamond with free white-glove delivery and 0% APR financing.';

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShopBrand();
  const title = composeBrandTitle(shop?.name ?? 'LA Mattress Store', shop?.brand?.slogan, FALLBACK_TITLE);
  const description = shop?.brand?.shortDescription ?? shop?.description ?? FALLBACK_DESCRIPTION;
  return {
    // `absolute` so the root layout's "%s · LA Mattress Store" template
    // can't re-append the brand a third time (cowork LOW#12).
    title: { absolute: title },
    description,
    alternates: { canonical: 'https://www.mattressstoreslosangeles.com/' },
  };
}

// Site-wide Organization / LocalBusiness / WebSite JSON-LD lives in app/layout.tsx
// and emits on every page. Per-template structured data (Product, CollectionPage,
// BlogPosting, etc.) is emitted by each route's page.tsx.

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
  const [shopifySlides, reviewsExtension] = await Promise.all([
    getHeroSlides(),
    getSitewideReviewsExtension(LOCAL_BUSINESS_ID),
  ]);
  const slides = shopifySlides.length > 0 ? shopifySlides : FALLBACK_HERO_SLIDES;
  const localBusinessLd = reviewsExtension
    ? { ...LOCAL_BUSINESS_LD, ...reviewsExtension }
    : LOCAL_BUSINESS_LD;

  return (
    <main>
      <Hero slides={slides} />
      <RecentlyViewedRail heading="Welcome back" eyebrow="Pick up where you left off" />
      <PopularProducts />
      <ShopByCategory />
      <Showrooms />
      <BrandStrip />
      <FeaturedGuides />
      <WhyUs />
      <QuizTeaser />
      <Reviews />
      <FAQ />
      <script
        id="ld-faq-home"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
      <script
        id="ld-localbusiness-home"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessLd) }}
      />
    </main>
  );
}
