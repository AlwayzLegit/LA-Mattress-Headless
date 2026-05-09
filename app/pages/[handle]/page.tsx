import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import Image from 'next/image';

import { getPageByHandle } from '@/lib/shopify';
import { publishedPages } from '@/lib/inventory';
import { SHOWROOMS, findShowroom, getOpenStatus, type Showroom } from '@/lib/showrooms';
import { capTitle, truncDescription, firstNonEmpty, stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { SITE_PHONE_SCHEMA } from '@/lib/site-config';
import { Icon } from '@/app/_components/icon';

type Params = { params: Promise<{ handle: string }> };

export const revalidate = 600;
export const dynamicParams = true;

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);
const SITE = 'https://mattressstoreslosangeles.com';

export function generateStaticParams() {
  if (!SHOPIFY_CONFIGURED) return [];
  return publishedPages.map((p) => ({ handle: p.handle }));
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) return { title: 'Page' };
  const page = await getPageByHandle(params.handle).catch(() => null);
  if (!page) return { title: 'Page not found' };
  const title = capTitle(firstNonEmpty(page.seo.title, page.title));
  const description = truncDescription(
    firstNonEmpty(page.seo.description, page.bodySummary, `${page.title} — LA Mattress Store`),
  );
  const url = `/pages/${page.handle}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', url, title, description },
  };
}

export default async function ShopifyPage(props: Params) {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) notFound();
  const page = await getPageByHandle(params.handle).catch(() => null);
  if (!page) notFound();

  const showroom = findShowroom(page.handle);
  if (showroom) return <ShowroomPage page={page} showroom={showroom} />;
  if (page.handle === 'mattress-store-locations') return <LocationsIndexPage page={page} />;

  return <DefaultPage page={page} />;
}

function DefaultPage({ page }: { page: Awaited<ReturnType<typeof getPageByHandle>> }) {
  if (!page) return null;

  return (
    <main className="container">
      <article className="cms-page" style={{ padding: 'var(--s-8) 0' }}>
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span>{toSentenceCase(stripBrandSuffix(page.title))}</span>
        </nav>
        <h1 className="h1" style={{ marginTop: 'var(--s-4)' }}>{toSentenceCase(stripBrandSuffix(page.title))}</h1>
        {page.body ? (
          <div className="rte cms-body" dangerouslySetInnerHTML={{ __html: sanitizeShopifyHtml(page.body) }} />
        ) : (
          <p className="muted">This page has no content yet.</p>
        )}
      </article>
    </main>
  );
}

function LocationsIndexPage({ page }: { page: NonNullable<Awaited<ReturnType<typeof getPageByHandle>>> }) {
  const url = `${SITE}/pages/${page.handle}`;

  // Top-level LocalBusiness w/ each showroom as a department/branch.
  const localBusinessLd = {
    '@context': 'https://schema.org',
    '@type': 'FurnitureStore',
    '@id': url,
    name: 'LA Mattress Store',
    url,
    telephone: SITE_PHONE_SCHEMA,
    priceRange: '$$$',
    image: `${SITE}/assets/la-mattress-logo.png`,
    areaServed: { '@type': 'City', name: 'Los Angeles' },
    department: SHOWROOMS.map((s) => ({
      '@type': 'FurnitureStore',
      name: s.name,
      url: `${SITE}/pages/${s.handle}`,
      telephone: s.phone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: s.street,
        addressLocality: s.city,
        addressRegion: s.region,
        postalCode: s.postalCode,
        addressCountry: 'US',
      },
      ...(s.geo ? { geo: { '@type': 'GeoCoordinates', latitude: s.geo.latitude, longitude: s.geo.longitude } } : {}),
    })),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Stores' },
    ],
  };

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
            Visit any of our showrooms across Los Angeles to try every mattress in person. Open daily — no appointment needed.
          </p>
        </header>

        <section className="locations-grid" aria-label="Showroom directory">
          {SHOWROOMS.map((s) => (
            <Link key={s.handle} href={`/pages/${s.handle}`} className="location-card">
              <div className="location-card-meta">
                <div className="eyebrow">{s.area}</div>
                <h2 className="location-card-name">{s.name}</h2>
                <address className="location-card-addr">
                  <div>{s.street}</div>
                  <div>{s.city}, {s.region} {s.postalCode}</div>
                </address>
                <div className="location-card-actions">
                  <span className="location-card-phone tnum">{s.phone.replace('+1-', '(').replace(/-/, ') ').replace(/-/, '-')}</span>
                  <span className="link-arrow">Store details <Icon name="arrow-right" size={14} /></span>
                </div>
              </div>
            </Link>
          ))}
        </section>

        {/*
         * NOT rendering page.body here — the merchant's CMS body for
         * /pages/mattress-store-locations is ~31KB of HTML using ~91
         * Hydrogen-theme CSS classes (.loc-card, .compare-grid,
         * .brand-tile, .delivery-feature, .faq-trigger, etc.) that
         * don't exist in this storefront's CSS, so the body renders
         * as completely unstyled markup. Our own <section class="locations-grid">
         * above replaces the directory portion of that body. If the
         * merchant wants the comparison / brands / FAQ sections back,
         * they need to be rewritten as components or the relevant
         * theme CSS ported over.
         */}
      </article>
      <script id="ld-locations" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessLd) }} />
      <script id="ld-breadcrumb-locations" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
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
  const url = `${SITE}/pages/${page.handle}`;
  const openStatus = getOpenStatus(showroom);
  const mapEmbedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(
    `${showroom.street}, ${showroom.city}, ${showroom.region} ${showroom.postalCode}`,
  )}&z=15&output=embed`;

  const localBusinessLd = {
    '@context': 'https://schema.org',
    '@type': 'FurnitureStore',
    '@id': url,
    name: showroom.name,
    url,
    telephone: showroom.phone,
    priceRange: '$$$',
    image: showroom.imageUrl ?? `${SITE}/assets/la-mattress-logo.png`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: showroom.street,
      addressLocality: showroom.city,
      addressRegion: showroom.region,
      postalCode: showroom.postalCode,
      addressCountry: 'US',
    },
    ...(showroom.geo
      ? { geo: { '@type': 'GeoCoordinates', latitude: showroom.geo.latitude, longitude: showroom.geo.longitude } }
      : {}),
    openingHoursSpecification: showroom.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek:
        h.day === 'Mon-Sat'
          ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          : h.day === 'Sun'
            ? 'Sunday'
            : h.day,
      opens: h.open,
      closes: h.close,
    })),
    areaServed: ['Los Angeles', showroom.area],
    parentOrganization: { '@type': 'Organization', name: 'LA Mattress Store', url: SITE },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Stores', item: `${SITE}/pages/mattress-store-locations` },
      { '@type': 'ListItem', position: 3, name: showroom.area },
    ],
  };

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
          <div className={`showroom-open-status${openStatus.isOpen ? ' is-open' : ''}`}>
            <span className="showroom-open-dot" aria-hidden /> {openStatus.message}
          </div>
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
              <Icon name="phone" size={14} /> {showroom.phone}
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
            {page.body ? (
              <div className="rte cms-body" dangerouslySetInnerHTML={{ __html: sanitizeShopifyHtml(page.body) }} />
            ) : (
              <p className="muted">More information about this showroom is coming soon.</p>
            )}
          </div>
        </section>

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
      <script id="ld-showroom" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessLd) }} />
      <script id="ld-breadcrumb-showroom" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script id="ld-services" type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Service',
              serviceType: 'Free White-Glove Mattress Delivery',
              provider: { '@type': 'FurnitureStore', '@id': url, name: showroom.name },
              areaServed: { '@type': 'City', name: 'Los Angeles' },
              description: 'Free white-glove delivery and setup with old-mattress haul-away across Los Angeles.',
            },
            {
              '@type': 'Service',
              serviceType: '0% APR Mattress Financing',
              provider: { '@type': 'FurnitureStore', '@id': url, name: showroom.name },
              areaServed: { '@type': 'City', name: 'Los Angeles' },
              description: 'Up to 60 months 0% APR financing on approved credit, no prepayment penalty, no origination fees.',
            },
            {
              '@type': 'Service',
              serviceType: '120-Night Comfort Exchange',
              provider: { '@type': 'FurnitureStore', '@id': url, name: showroom.name },
              areaServed: { '@type': 'City', name: 'Los Angeles' },
              description: 'Sleep on it for at least 30 nights, then exchange for any other mattress within 120 nights of delivery.',
            },
          ],
        }),
      }} />
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
