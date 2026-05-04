import type { Metadata } from 'next';
import { preload } from 'react-dom';

import { Hero } from './_components/hero';
import { IMAGES } from './_components/images';
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
    'Family-owned LA mattress store with 5 showrooms. Tempur-Pedic, Stearns & Foster, Helix, Diamond — white glove delivery & 0% APR financing.',
  alternates: { canonical: 'https://mattressstoreslosangeles.com/' },
};

// Site-wide Organization / LocalBusiness / WebSite JSON-LD lives in app/layout.tsx
// and emits on every page. Per-template structured data (Product, CollectionPage,
// BlogPosting, etc.) is emitted by each route's page.tsx.

export default function Home() {
  // Preload the first hero slide image so it lands before CSS sets it as a
  // background-image (otherwise it's the LCP and waits behind the CSS chain).
  preload(IMAGES['hero-showroom'], { as: 'image', fetchPriority: 'high' });

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
