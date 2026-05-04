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

export const metadata: Metadata = {
  title: 'LA Mattress — Sleep, engineered in Los Angeles.',
  description:
    'Family-owned LA mattress store with 5 showrooms across Los Angeles. Tempur-Pedic, Stearns & Foster, Helix, Diamond and more — same-day white glove delivery, 120-night comfort exchange, 0% APR financing.',
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
      <PopularProducts />
      <ShopByCategory />
      <Showrooms />
      <BrandStrip />
      <WhyUs />
      <QuizTeaser />
      <Reviews />
      <FAQ />
    </>
  );
}
