import type { Metadata } from 'next';
import Script from 'next/script';

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

const ORG_LD = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': 'https://mattressstoreslosangeles.com/#localbusiness',
  name: 'LA Mattress Store',
  url: 'https://mattressstoreslosangeles.com/',
  telephone: '+1-213-555-0142',
  priceRange: '$$$',
  image: 'https://mattressstoreslosangeles.com/assets/la-mattress-logo.png',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '3550 Wilshire Blvd',
    addressLocality: 'Los Angeles',
    addressRegion: 'CA',
    postalCode: '90010',
    addressCountry: 'US',
  },
  areaServed: { '@type': 'City', name: 'Los Angeles' },
  sameAs: [
    'https://www.google.com/maps/place/LA+Mattress+Store',
  ],
};

const WEBSITE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  url: 'https://mattressstoreslosangeles.com/',
  name: 'LA Mattress Store',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://mattressstoreslosangeles.com/search?q={query}',
    'query-input': 'required name=query',
  },
};

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

      <Script id="ld-localbusiness" type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_LD) }} />
      <Script id="ld-website" type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }} />
    </>
  );
}
