import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

import { getBrands } from '@/lib/shopify';
import type { Brand } from '@/lib/shopify';
import { brandLogo } from '@/lib/brand-logos';
import { Icon } from '@/app/_components/icon';

/**
 * `/pages/mattress-brands` — coded, on-brand brand directory.
 *
 * This static route deliberately overrides the generic Shopify-CMS
 * renderer (`app/pages/[handle]/page.tsx`) for this one handle: the brand
 * list is now derived live from `getBrands()` (product vendors + verified
 * brand collections), so a newly-onboarded brand — e.g. Sleep & Beyond —
 * appears here automatically with no content edit, exactly like the nav
 * mega and the homepage brand strip. Logos come from the
 * `lib/brand-logos.ts` registry with a text-wordmark fallback.
 */

const SITE = 'https://www.mattressstoreslosangeles.com';

// Used only when the Storefront API is unconfigured/unreachable so the
// page never renders empty. Mirrors the homepage BrandStrip fallback,
// plus Sleep & Beyond (a stocked bedding brand that lives outside the
// `…-mattresses` collection convention).
const FALLBACK_BRANDS: Brand[] = [
  { name: 'Chattam & Wells',  handle: 'chattam-wells-mattresses',  href: '/collections/chattam-wells-mattresses' },
  { name: 'Diamond',          handle: 'diamond-mattresses',        href: '/collections/diamond-mattresses' },
  { name: 'Eastman House',    handle: 'eastman-house-mattresses',  href: '/collections/eastman-house-mattresses' },
  { name: 'Englander',        handle: 'englander-mattresses',      href: '/collections/englander-mattresses' },
  { name: 'Harvest Green',    handle: 'harvest-mattresses',        href: '/collections/harvest-mattresses' },
  { name: 'Helix',            handle: 'helix-mattresses',          href: '/collections/helix-mattresses' },
  { name: 'Sleep & Beyond',   handle: 'sleep-beyond',              href: '/collections/sleep-beyond' },
  { name: 'Spring Air',       handle: 'spring-air-mattresses',     href: '/collections/spring-air-mattresses' },
  { name: 'Stearns & Foster', handle: 'stearns-foster-mattresses', href: '/collections/stearns-foster-mattresses' },
  { name: 'Tempur-Pedic',     handle: 'tempur-pedic-mattresses',   href: '/collections/tempur-pedic-mattresses' },
];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: 'Mattress Brands We Carry · LA Mattress Store' },
  description:
    'Every mattress and bedding brand stocked at LA Mattress Store — Tempur-Pedic, Stearns & Foster, Helix, Diamond, Sleep & Beyond and more. Try them across five Los Angeles showrooms with free white-glove delivery.',
  alternates: { canonical: '/pages/mattress-brands' },
  openGraph: {
    type: 'website',
    url: '/pages/mattress-brands',
    title: 'Mattress Brands We Carry · LA Mattress Store',
    description:
      'The full brand lineup at LA Mattress Store — premium, performance, value, and organic bedding brands, all on the floor at five LA showrooms.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
};

export default async function MattressBrandsPage() {
  const live = await getBrands();
  const brands = (live.length ? live : FALLBACK_BRANDS)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Brands', item: `${SITE}/pages/mattress-brands` },
    ],
  };

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Mattress & bedding brands carried by LA Mattress Store',
    itemListElement: brands.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: b.name,
      url: `${SITE}${b.href}`,
    })),
  };

  return (
    <>
      <section className="lp-hero">
        <div className="container">
          <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="sep" aria-hidden="true">/</span>
            <span>Brands</span>
          </nav>
          <div className="lp-hero-inner lp-hero-inner-stacked">
            <div className="lp-hero-copy">
              <div className="eyebrow">The brands we carry</div>
              <h1 className="h-display">Every brand,<br />on the floor.</h1>
              <p className="lp-hero-lede" style={{ maxWidth: '64ch' }}>
                We&apos;re an authorized dealer for the brands that matter — premium,
                performance, value, and organic. Every one is set up at one of our five
                Los Angeles showrooms, so you can lie down and compare before you buy.
              </p>
              <div className="lp-hero-meta">
                <span><strong>{brands.length}</strong> brands</span>
                <span><strong>5</strong> LA showrooms</span>
                <span><strong>Free</strong> white-glove delivery</span>
                <span><strong>120-night</strong> exchange</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="brands-page-grid" aria-label="Mattress and bedding brands">
            {brands.map((b) => {
              const logo = brandLogo(b.handle);
              return (
                <Link href={b.href} key={b.handle} className="brand-card">
                  <div className="brand-card-logo">
                    {logo ? (
                      <Image
                        src={logo.src}
                        alt={logo.alt ?? `${b.name} logo`}
                        width={logo.width}
                        height={logo.height}
                        style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <span className="brand-card-wordmark">{b.name}</span>
                    )}
                  </div>
                  <div className="brand-card-foot">
                    <span className="brand-card-name">{b.name}</span>
                    <span className="brand-card-cta">
                      Shop <Icon name="arrow-right" size={14} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <script id="ld-breadcrumb-brands" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script id="ld-brands-itemlist" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
    </>
  );
}
