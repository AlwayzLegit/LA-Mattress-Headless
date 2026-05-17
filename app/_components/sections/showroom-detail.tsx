// Consistent, SEO-bearing content block rendered for EVERY showroom
// page (see app/pages/[handle]/page.tsx → ShowroomPage). Guarantees a
// uniform look/feel and a strong local-SEO baseline even when a
// showroom's Shopify CMS body is thin or empty. Each section is
// templated from per-showroom data (area, cross street, nearby areas)
// so the five pages stay genuinely distinct rather than near-duplicate.
//
// The merchant CMS body, when present, renders as a supplemental
// "More about this store" section below — it adds local colour, it is
// no longer load-bearing for the page having content.

import Link from 'next/link';
import { getBrands } from '@/lib/shopify';
import type { Showroom } from '@/lib/showrooms';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { Icon } from '../icon';

export async function ShowroomDetail({
  showroom,
  cmsBody,
}: {
  showroom: Showroom;
  cmsBody: string | null;
}) {
  const brands = (await getBrands()).slice().sort((a, b) => a.name.localeCompare(b.name));
  const areas = showroom.nearbyAreas;
  const areaList =
    areas.length > 1
      ? `${areas.slice(0, -1).join(', ')}, and ${areas[areas.length - 1]}`
      : areas[0] ?? showroom.area;

  return (
    <>
      <section className="section showroom-areas" aria-labelledby="sd-areas-h">
        <div className="eyebrow">Serving the neighborhood</div>
        <h2 id="sd-areas-h" className="h2">Mattress shopping &amp; delivery near {showroom.area}</h2>
        <p className="muted" style={{ maxWidth: '64ch' }}>
          Our {showroom.area} showroom at {showroom.street}
          {showroom.crossStreet ? ` (${showroom.crossStreet})` : ''} is the closest
          LA Mattress store for {areaList}. Free white-glove delivery anywhere in
          Los Angeles on orders over $499 — same-day when you order by 4 PM, with
          setup and free haul-away of your old mattress included.
        </p>
        <ul className="showroom-chips" aria-label={`Areas served from the ${showroom.area} showroom`}>
          {areas.map((a) => (
            <li key={a} className="showroom-chip">{a}</li>
          ))}
        </ul>
      </section>

      {brands.length ? (
        <section className="section showroom-brands" aria-labelledby="sd-brands-h">
          <div className="eyebrow">Try before you buy</div>
          <h2 id="sd-brands-h" className="h2">Every brand we carry, on the {showroom.area} floor</h2>
          <p className="muted" style={{ maxWidth: '64ch' }}>
            Lie down and compare every mattress brand we sell, side by side, before
            you decide — no commission-only staff, no pressure.
          </p>
          <ul className="showroom-chips" aria-label="Mattress brands on the showroom floor">
            {brands.map((b) => (
              <li key={b.handle}>
                <Link href={b.href} className="showroom-chip showroom-chip-link">
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section showroom-expect" aria-labelledby="sd-expect-h">
        <div className="eyebrow">What to expect</div>
        <h2 id="sd-expect-h" className="h2">Visiting the {showroom.area} store</h2>
        <ul className="showroom-expect-list">
          <li>
            <Icon name="home" size={18} />
            <span><strong>Walk-ins welcome.</strong> No appointment needed — every mattress on the {showroom.area} floor is set up to try. Plan 20–40 minutes for a thorough visit.</span>
          </li>
          <li>
            <Icon name="shield" size={18} />
            <span><strong>No-pressure, salaried team.</strong> Our consultants work on salary, never commission — they help you narrow it down, then leave you to think.</span>
          </li>
          <li>
            <Icon name="truck" size={18} />
            <span><strong>Same-day LA delivery.</strong> Order by 4 PM for same-day white-glove delivery — setup and old-mattress haul-away included on orders over $499.</span>
          </li>
          <li>
            <Icon name="card" size={18} />
            <span><strong>0% APR financing.</strong> Through Synchrony and Acima on approved credit — apply in-store or online, usually approved in under a minute.</span>
          </li>
        </ul>
        <div className="showroom-expect-cta">
          <a href={showroom.mapUrl} target="_blank" rel="noopener" className="btn btn-primary">
            Get directions <Icon name="arrow-up-right" size={14} />
          </a>
          <Link href="/sleep-quiz" className="btn btn-ghost">
            Take the 2-min sleep quiz
          </Link>
        </div>
      </section>

      {cmsBody ? (
        <section className="section" aria-labelledby="sd-more-h">
          <div className="eyebrow">More about this store</div>
          <h2 id="sd-more-h" className="h2">The {showroom.area} story</h2>
          <div
            className="rte cms-body"
            dangerouslySetInnerHTML={{ __html: sanitizeShopifyHtml(cmsBody) }}
          />
        </section>
      ) : null}
    </>
  );
}
