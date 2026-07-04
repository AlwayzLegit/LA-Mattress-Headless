import Link from 'next/link';

import type { Page } from '@/lib/shopify/types';
import { getCollectionByHandle } from '@/lib/shopify';
import { formatPhone } from '@/lib/showrooms';
import { getNearestShowrooms, getNearbyNeighborhoods, type Neighborhood } from '@/lib/neighborhoods';
import { LOCAL_GUIDES } from '@/lib/local-guides';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { Icon } from '@/app/_components/icon';
import { PlpCard } from '@/app/_components/plp-card';
import { SALE_CATEGORY_CHIPS } from '@/app/_components/sections/sale-page';

/**
 * Phase 277e: LA-neighborhood page template (Beverly Hills, Santa Monica,
 * DTLA, Pasadena, Burbank, Sherman Oaks, Hollywood, Long Beach). Each
 * page targets "mattress store {neighborhood}" search intent without
 * pretending to be a physical store of its own — there's no address,
 * no own hours, no map embed. Instead, the page positions the 1–2
 * nearest physical showrooms with drive-time context and a clear
 * "Visit our nearest showroom" CTA.
 *
 * Renders only when the merchant has created a Shopify Page with one
 * of the handles defined in lib/neighborhoods.ts NEIGHBORHOODS. If the
 * Shopify page body is empty, the neighborhood's `defaultBlurb` fills
 * in (≥150 words to avoid thin-content flags).
 *
 * Schema: FurnitureStore with `areaServed` set to the neighborhood
 * (not `address` — see lib/neighborhoods.ts comments) and `department`
 * listing the nearest physical showrooms so Google can still see the
 * real stores behind this landing page.
 *
 * Extracted from app/(storefront)/pages/[handle]/page.tsx (deep audit
 * codeq-godfile-01) — pure move, no behavior change.
 */
export async function NeighborhoodPage({
  page,
  neighborhood,
}: {
  page: Page;
  neighborhood: Neighborhood;
}) {
  const nearest = getNearestShowrooms(neighborhood);
  const primaryShowroom = nearest[0]; // first listed is the "primary" CTA
  // Sibling neighborhoods served by the same showroom(s) — cross-links
  // that turn the 27 isolated neighborhood pages into a connected cluster
  // (Semrush Linking score / crawl-depth fix). See getNearbyNeighborhoods.
  const nearbyNeighborhoods = getNearbyNeighborhoods(neighborhood);
  // Real shop surface: best-selling mattresses so the page isn't a wall
  // of text — gives the local landing page actual product cards + a
  // commercial signal, with same ISR caching as every other PLP fetch.
  // Falls back gracefully (empty grid hidden) if the collection errors.
  const bestSellers = await getCollectionByHandle({
    handle: 'mattresses',
    first: 8,
    sortKey: 'BEST_SELLING',
  }).catch(() => null);
  const featured = bestSellers?.products.nodes ?? [];

  return (
    <main className="container">
      {/* Full-width wrapper (NOT .cms-page — that pins content to a 760px
          left column, which left the product grid / trust strip / showroom
          tiles crammed left with the right half of the desktop page empty).
          Prose blocks below carry their own readable max-width. */}
      <article className="neighborhood-page" style={{ padding: 'var(--s-7) 0 var(--s-9)' }}>
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          <Link href="/pages/mattress-store-locations">Stores</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span>{neighborhood.name}</span>
        </nav>

        <header className="showroom-page-hero">
          <div className="eyebrow">{neighborhood.name} · Los Angeles</div>
          {/* Phase 292 (cowork MEDIUM#6/#7): build the H1 from the
              proper-cased neighborhood.name + ", Los Angeles" instead of
              toSentenceCase(page.title). The old path lowercased the
              neighborhood ("Mattress store in burbank") and dropped any
              LA reference. Skip the ", Los Angeles" suffix when the name
              already contains "LA" (Downtown LA) to avoid "… LA, Los
              Angeles". Still differs from <title> case-normalized
              ("… | LA Mattress"), so no duplicate-H1/title regression. */}
          <h1 className="h1">
            {/* High-value areas (Pasadena, Santa Monica, etc.) override the
                H1 toward the higher-volume plural "mattress stores [area]"
                pattern via the custom.seo_h1 metafield (SEMrush 20260621:
                "mattress stores pasadena" 110 vs singular 70). Everything
                else uses the default singular H1. */}
            {page.seoH1 ??
              `Mattress store in ${neighborhood.name}${/\bLA\b/.test(neighborhood.name) ? '' : ', Los Angeles'}`}
          </h1>
          <p className="lp-hero-lede" style={{ maxWidth: '60ch' }}>
            Free white-glove delivery to {neighborhood.name} on orders over $499 — same-day if you order by 4pm.{' '}
            {primaryShowroom
              ? `Visit our ${primaryShowroom.area} showroom to try every mattress in person.`
              : 'Visit any of our 5 LA showrooms to try every mattress in person.'}
          </p>
          <div
            style={{ display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap', marginTop: 'var(--s-5)' }}
          >
            <Link href="/collections/mattresses" className="btn btn-primary">
              Shop mattresses <Icon name="arrow-right" size={14} />
            </Link>
            {primaryShowroom ? (
              <a href={`tel:${primaryShowroom.phone.replace(/[^+\d]/g, '')}`} className="btn btn-ghost">
                <Icon name="phone" size={14} /> {formatPhone(primaryShowroom.phone)}
              </a>
            ) : null}
            <Link
              href={primaryShowroom ? `/pages/${primaryShowroom.handle}` : '/pages/mattress-store-locations'}
              className="btn btn-ghost"
            >
              Find your showroom
            </Link>
          </div>
        </header>

        <section className="locations-trust" aria-label="What every order includes" style={{ marginTop: 'var(--s-6)' }}>
          <div className="locations-trust-item">
            <Icon name="truck" size={18} />
            <div>
              <div className="locations-trust-title">Free {neighborhood.name} delivery</div>
              <div className="locations-trust-sub">White-glove, same-day if ordered by 4 PM</div>
            </div>
          </div>
          <div className="locations-trust-item">
            <Icon name="shield" size={18} />
            <div>
              <div className="locations-trust-title">120-night exchange</div>
              <div className="locations-trust-sub">Sleep on it, swap if it isn&rsquo;t right</div>
            </div>
          </div>
          <div className="locations-trust-item">
            <Icon name="card" size={18} />
            <div>
              <div className="locations-trust-title">0% APR financing</div>
              <div className="locations-trust-sub">Synchrony &amp; Acima — instant approval</div>
            </div>
          </div>
        </section>

        {/* Audit fix: crawlable NAP (name/address/phone) for the
            nearest physical showroom. Previously NAP only lived in
            JSON-LD; local pack ranking weighs visible text NAP too. */}
        {primaryShowroom ? (
          <aside className="neighborhood-nap-card" aria-label={`${primaryShowroom.name} showroom contact`}>
            <div>
              <div className="neighborhood-nap-eyebrow">Nearest showroom</div>
              <div className="neighborhood-nap-name">{primaryShowroom.name}</div>
            </div>
            <address className="neighborhood-nap-addr">
              <div>{primaryShowroom.street}</div>
              <div>{primaryShowroom.city}, {primaryShowroom.region} {primaryShowroom.postalCode}</div>
            </address>
            <a href={`tel:${primaryShowroom.phone.replace(/[^+\d]/g, '')}`} className="neighborhood-nap-phone">
              <Icon name="phone" size={14} /> {formatPhone(primaryShowroom.phone)}
            </a>
          </aside>
        ) : null}

        {page.body ? (
          <div
            className="rte cms-body"
            style={{ marginTop: 'var(--s-5)', maxWidth: '72ch' }}
            dangerouslySetInnerHTML={{ __html: autoLinkArticleBody(sanitizeShopifyHtml(page.body)) }}
          />
        ) : (
          <div className="rte cms-body" style={{ marginTop: 'var(--s-5)', maxWidth: '72ch' }}>
            <p>{neighborhood.defaultBlurb}</p>
          </div>
        )}

        {featured.length > 0 ? (
          <section className="section" style={{ marginTop: 'var(--s-7)' }} aria-labelledby="np-shop-h">
            <div className="eyebrow">Shop now</div>
            <h2 id="np-shop-h" className="h2">Best-selling mattresses we deliver to {neighborhood.name}</h2>
            <p className="muted" style={{ maxWidth: '60ch' }}>
              Every model below ships free to {neighborhood.name} with white-glove setup and old-mattress haul-away
              {primaryShowroom ? ` — or come test them in person at our ${primaryShowroom.area} showroom.` : '.'}
            </p>
            <nav className="sale-page-chips" aria-label="Shop mattresses by type" style={{ marginTop: 'var(--s-4)' }}>
              {SALE_CATEGORY_CHIPS.map((chip) => (
                <Link key={chip.href} href={chip.href} className="sale-page-chip">
                  {chip.label}
                </Link>
              ))}
            </nav>
            <div className="plp-grid" style={{ marginTop: 'var(--s-5)' }}>
              {featured.map((p, i) => (
                <PlpCard key={p.id} product={p} priority={i < 2} />
              ))}
            </div>
            <div style={{ marginTop: 'var(--s-5)' }}>
              <Link href="/collections/mattresses" className="btn btn-primary btn-lg">
                Shop all mattresses <Icon name="arrow-right" size={16} />
              </Link>
              <Link href="/collections/on-sale" className="btn btn-ghost btn-lg" style={{ marginLeft: 'var(--s-3)' }}>
                See current deals
              </Link>
            </div>
          </section>
        ) : null}

        {nearest.length > 0 ? (
          <section className="section" style={{ marginTop: 'var(--s-7)' }}>
            <div className="eyebrow">Nearest showrooms</div>
            <h2 className="h2">
              {nearest.length === 1
                ? `Visit our ${nearest[0].area} mattress store`
                : `Two showrooms near ${neighborhood.name}`}
            </h2>
            <div className="nf-grid" style={{ marginTop: 'var(--s-5)' }}>
              {nearest.map((s) => (
                <Link key={s.handle} href={`/pages/${s.handle}`} className="nf-tile">
                  <div className="nf-tile-label">{s.name}</div>
                  <div className="nf-tile-sub muted">
                    {s.street}, {s.city} · {formatPhone(s.phone)}
                  </div>
                  <Icon name="arrow-right" size={16} />
                </Link>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 'var(--s-5)', maxWidth: '60ch' }}>
              Prefer to see all 5 showrooms?{' '}
              <Link href="/pages/mattress-store-locations" className="link-arrow">
                View every Los Angeles location <Icon name="arrow-right" size={14} />
              </Link>
              .
            </p>
          </section>
        ) : null}

        {nearbyNeighborhoods.length > 0 ? (
          <section className="section showroom-neighborhoods" style={{ marginTop: 'var(--s-7)' }} aria-labelledby="np-nearby-h">
            <div className="eyebrow">Nearby neighborhoods</div>
            <h2 id="np-nearby-h" className="h2">
              {primaryShowroom
                ? `Other areas near the ${primaryShowroom.area} store`
                : 'Other LA neighborhoods we serve'}
            </h2>
            <p className="muted" style={{ maxWidth: '60ch' }}>
              We deliver to these nearby neighborhoods from the same showroom — open
              one for local delivery details and the brands we keep on the floor.
            </p>
            <ul
              className="showroom-chips"
              style={{ marginTop: 'var(--s-4)' }}
              aria-label={`Other LA neighborhoods served near ${neighborhood.name}`}
            >
              {nearbyNeighborhoods.map((n) => (
                <li key={n.handle}>
                  <Link href={`/pages/${n.handle}`} className="showroom-chip showroom-chip-link">
                    {n.name} mattress store
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {LOCAL_GUIDES.length > 0 ? (
          <section className="section" style={{ marginTop: 'var(--s-7)' }} aria-labelledby="np-guides-h">
            <div className="eyebrow">Local mattress guides</div>
            <h2 id="np-guides-h" className="h2">Buying guides for Los Angeles sleepers</h2>
            <p className="muted" style={{ maxWidth: '60ch' }}>
              Local picks and advice from our sleep team — read up before you visit the showroom.
            </p>
            <div className="nf-grid" style={{ marginTop: 'var(--s-5)' }}>
              {LOCAL_GUIDES.map((g) => (
                <Link key={g.href} href={g.href} className="nf-tile">
                  <div className="nf-tile-label">{g.title}</div>
                  <div className="nf-tile-sub muted">{g.blurb}</div>
                  <Icon name="arrow-right" size={16} />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="section" style={{ marginTop: 'var(--s-7)' }}>
          <div className="eyebrow">Skip the drive</div>
          <h2 className="h2">Take the 2-minute sleep quiz</h2>
          <p className="muted" style={{ maxWidth: '60ch' }}>
            Eight questions, one recommendation. We&rsquo;ll match you to a mattress, then deliver it free anywhere in LA.
          </p>
          <div style={{ marginTop: 'var(--s-4)' }}>
            <Link href="/sleep-quiz" className="btn btn-primary">
              Start the quiz <Icon name="arrow-right" size={14} />
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
