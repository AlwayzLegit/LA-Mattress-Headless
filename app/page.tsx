import type { Metadata } from 'next';

import { Hero } from './_components/hero';
import {
  TrustBar,
  ShopByCategory,
  BrandStrip,
  WhyUs,
  QuizTeaser,
  Reviews,
} from './_components/sections/static-sections';
import { PopularProducts } from './_components/sections/popular-products';
import { Showrooms } from './_components/sections/showrooms';
import { FAQ } from './_components/sections/faq';
import { RecentlyViewedRail } from './_components/recently-viewed';
import { faqJsonLd } from '@/lib/faq';
import { LOCAL_BUSINESS_LD } from '@/lib/structured-data';
import { getShopBrand, getHeroSlides } from '@/lib/shopify';
import { FALLBACK_HERO_SLIDES } from './_components/hero-slides';

// Phase 268: homepage title + description now read from Shopify Brand
// (Settings → Store details → Brand) when available, with hardcoded
// fallbacks for unconfigured stores or empty Brand fields.
const FALLBACK_TITLE = 'LA Mattress — Sleep, engineered in Los Angeles.';
const FALLBACK_DESCRIPTION =
  'Family-owned LA mattress store with 5 showrooms. Tempur-Pedic, Stearns & Foster, Helix, Diamond — white-glove delivery & 0% APR financing.';

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShopBrand();
  const title = shop?.brand?.slogan
    ? `${shop?.name ?? 'LA Mattress'} — ${shop.brand.slogan}`
    : FALLBACK_TITLE;
  const description = shop?.brand?.shortDescription ?? shop?.description ?? FALLBACK_DESCRIPTION;
  return {
    title,
    description,
    alternates: { canonical: 'https://mattressstoreslosangeles.com/' },
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
  const shopifySlides = await getHeroSlides();
  const slides = shopifySlides.length > 0 ? shopifySlides : FALLBACK_HERO_SLIDES;

  return (
    <main>
      <Hero slides={slides} />
      <TrustBar />
      <RecentlyViewedRail heading="Welcome back" eyebrow="Pick up where you left off" />
      <PopularProducts />
      <ShopByCategory />
      <Showrooms />
      <BrandStrip />
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_LD) }}
      />
    </main>
  );
}
