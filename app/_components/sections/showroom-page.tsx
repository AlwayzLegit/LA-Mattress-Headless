import Link from 'next/link';
import Image from 'next/image';

import type { Page } from '@/lib/shopify/types';
import { formatPhone, type Showroom } from '@/lib/showrooms';
import { stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import { Icon } from '@/app/_components/icon';
import { ShowroomDetail } from '@/app/_components/sections/showroom-detail';
import { ShowroomOpenStatus } from '@/app/_components/showroom-open-status';

/**
 * Individual showroom template (`/pages/mattress-store-los-angeles`,
 * `-studio-city`, etc. — any handle matched by findShowroom). Extracted
 * from app/(storefront)/pages/[handle]/page.tsx (deep audit
 * codeq-godfile-01) — pure move, no behavior change.
 */
export function ShowroomPage({
  page,
  showroom,
}: {
  page: Page;
  showroom: Showroom;
}) {
  const mapEmbedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(
    `${showroom.street}, ${showroom.city}, ${showroom.region} ${showroom.postalCode}`,
  )}&z=15&output=embed`;

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
          <ShowroomOpenStatus showroom={showroom} />
          <p className="lp-hero-lede" style={{ maxWidth: '60ch' }}>
            Looking for a mattress store near you in {showroom.area}? Visit our showroom to try every mattress, talk with our local team, and walk out the same day with free white-glove delivery on most beds.
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
              // Explicit fetchPriority backs up the `priority` prop —
              // showroom hero photos showed LCP p95 9.3s on
              // /pages/mattress-store-studio-city (and similar tails on
              // koreatown / la-brea / west-la). priority should add
              // fetchPriority="high" automatically; the explicit hint
              // removes any browser-scheduler ambiguity.
              fetchPriority="high"
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
              <Icon name="phone" size={14} /> {formatPhone(showroom.phone)}
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
          </div>
        </section>

        <ShowroomDetail showroom={showroom} cmsBody={page.body ?? null} />

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
