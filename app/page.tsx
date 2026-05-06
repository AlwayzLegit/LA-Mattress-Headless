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

export const metadata: Metadata = {
  title: 'LA Mattress — Sleep, engineered in Los Angeles.',
  description:
    'Family-owned LA mattress store with 5 showrooms. Tempur-Pedic, Stearns & Foster, Helix, Diamond — white glove delivery & 0% APR financing.',
  alternates: { canonical: 'https://mattressstoreslosangeles.com/' },
};

// Site-wide Organization / LocalBusiness / WebSite JSON-LD lives in app/layout.tsx
// and emits on every page. Per-template structured data (Product, CollectionPage,
// BlogPosting, etc.) is emitted by each route's page.tsx.

export default function Home() {
  return (
    <>
      <Hero />
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
    </>
  );
}
