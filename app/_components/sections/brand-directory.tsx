// Hard-coded, on-brand brand directory injected into the CMS-driven
// /pages/mattress-brands page (see app/pages/[handle]/page.tsx). The
// merchant-authored CMS body still renders; this adds a live brand grid
// below it, derived from getBrands() so a newly-onboarded brand
// (e.g. Sleep & Beyond) appears automatically. Logos come from the
// lib/brand-logos.ts registry with a text-wordmark fallback.

import Link from 'next/link';
import { getBrands } from '@/lib/shopify';
import type { Brand } from '@/lib/shopify';
import { brandLogo } from '@/lib/brand-logos';
import { BrandLogo } from '../brand-logo';
import { Icon } from '../icon';

// Used only when the Storefront API is unconfigured/unreachable so the
// grid never renders empty. Mirrors the homepage BrandStrip fallback,
// plus Sleep & Beyond (a stocked bedding brand outside the
// `…-mattresses` collection-handle convention).
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

export async function BrandDirectory() {
  const live = await getBrands();
  const brands = (live.length ? live : FALLBACK_BRANDS)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="section brand-directory" aria-labelledby="brand-directory-h">
      <div className="eyebrow">The brands we carry</div>
      <h2 id="brand-directory-h" className="h2">Every brand, on the floor.</h2>
      <p className="muted" style={{ maxWidth: '60ch', marginTop: 'var(--s-2)' }}>
        We&apos;re an authorized dealer for every brand below — set up across our
        five Los Angeles showrooms so you can lie down and compare before you buy.
      </p>
      <div className="brands-page-grid" aria-label="Mattress and bedding brands">
        {brands.map((b) => {
          const logo = brandLogo(b.handle);
          return (
            <Link href={b.href} key={b.handle} className="brand-card">
              <div className="brand-card-logo">
                {logo ? (
                  <BrandLogo
                    src={logo.src}
                    alt={logo.alt ?? `${b.name} logo`}
                    width={logo.width}
                    height={logo.height}
                    name={b.name}
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
    </section>
  );
}
