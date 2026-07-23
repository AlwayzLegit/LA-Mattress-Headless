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
import { type Showroom, SHOWROOMS } from '@/lib/showrooms';
import { getNeighborhoodsForShowroom } from '@/lib/neighborhoods';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { Icon } from '../icon';

export async function ShowroomDetail({
  showroom,
  cmsBody,
}: {
  showroom: Showroom;
  cmsBody: string | null;
}) {
  const brands = (await getBrands()).slice().sort((a, b) => a.name.localeCompare(b.name));
  // SEMrush 20260521_1: cross-link the 4 sibling showrooms so each
  // showroom page picks up 4 inbound links from each peer (vs the
  // previous 0 — showrooms only got linked from the locations index
  // and nav. Helps local-SEO and reduces the 117 crawl-depth flags).
  const otherShowrooms = SHOWROOMS.filter((s) => s.handle !== showroom.handle);
  // Hub-and-spoke internal linking: the neighborhood pages that name this
  // showroom as their nearest store. Rendered as a link list below so each
  // neighborhood page earns a second, topically-relevant inbound link from
  // its covering store (the first being the locations-index directory).
  const servedNeighborhoods = getNeighborhoodsForShowroom(showroom.handle);
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
          Los Angeles on orders over $499, same-day when you order by 4 PM, with
          setup and free haul-away of your old mattress included.
        </p>
        <ul className="showroom-chips" aria-label={`Areas served from the ${showroom.area} showroom`}>
          {areas.map((a) => (
            <li key={a} className="showroom-chip">{a}</li>
          ))}
        </ul>
      </section>

      {servedNeighborhoods.length ? (
        <section className="section showroom-neighborhoods" aria-labelledby="sd-nbhd-h">
          <div className="eyebrow">Neighborhoods we serve</div>
          <h2 id="sd-nbhd-h" className="h2">LA neighborhoods near the {showroom.area} store</h2>
          <p className="muted" style={{ maxWidth: '64ch' }}>
            The {showroom.area} showroom is the closest LA Mattress store for these
            neighborhoods, open yours for local delivery details, drive directions,
            and the brands we keep on the floor.
          </p>
          <ul className="showroom-chips" aria-label={`Neighborhoods served from the ${showroom.area} showroom`}>
            {servedNeighborhoods.map((n) => (
              <li key={n.handle}>
                <Link href={`/pages/${n.handle}`} className="showroom-chip showroom-chip-link">
                  {n.name} mattress store
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {brands.length ? (
        <section className="section showroom-brands" aria-labelledby="sd-brands-h">
          <div className="eyebrow">Try before you buy</div>
          <h2 id="sd-brands-h" className="h2">Every brand we carry, on the {showroom.area} floor</h2>
          <p className="muted" style={{ maxWidth: '64ch' }}>
            Lie down and compare every mattress brand we sell, side by side, before
            you decide, expert help when you want it, space to think when you don&rsquo;t.
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
            <span><strong>Walk-ins welcome.</strong> No appointment needed, every mattress on the {showroom.area} floor is set up to try. Plan 20–40 minutes for a thorough visit.</span>
          </li>
          <li>
            <Icon name="shield" size={18} />
            <span><strong>Expert, no-pressure help.</strong> Our sleep consultants are trained on every brand we carry, they help you narrow it down, then leave you to think.</span>
          </li>
          <li>
            <Icon name="truck" size={18} />
            <span><strong>Same-day LA delivery.</strong> Order by 4 PM for same-day white-glove delivery, setup and old-mattress haul-away included on orders over $499.</span>
          </li>
          <li>
            <Icon name="card" size={18} />
            <span><strong>0% APR financing.</strong> Through Synchrony and Acima on approved credit, apply in-store or online, usually approved in under a minute.</span>
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
          {/* Phase 308 SEO audit: route the showroom's merchant CMS
              body through autoLinkArticleBody so the body picks up
              first-mention internal links to brand collections, size
              pages, the sleep quiz, etc., same pattern every other
              CMS-body-rendering template uses (service-page,
              comparison-page, contact-page, legal-page, default page
              fallback in pages/[handle]/page.tsx). Without this,
              showroom pages were emitting their merchant body raw,
              which Semrush 20260530 flagged as `no internal links in
              body` on /pages/mattress-store-in-glendale (69 prio) and
              /pages/koreatown-best-mattress-store (3 prio). The
              showroom's structural chrome (nav, breadcrumbs, "Our
              other LA showrooms" rail) carries plenty of internal
              links page-wide, but Semrush's heuristic scopes to the
              authored body specifically. */}
          <div
            className="rte cms-body"
            dangerouslySetInnerHTML={{ __html: autoLinkArticleBody(sanitizeShopifyHtml(cmsBody)) }}
          />
        </section>
      ) : null}

      <section className="section showroom-other" aria-labelledby="sd-other-h">
        <div className="eyebrow">Our other LA showrooms</div>
        <h2 id="sd-other-h" className="h2">{showroom.area} not the closest? Try one of our other stores.</h2>
        <ul className="showroom-chips" aria-label="Other LA Mattress showrooms">
          {otherShowrooms.map((s) => (
            <li key={s.handle}>
              <Link href={`/pages/${s.handle}`} className="showroom-chip showroom-chip-link">
                {s.area}, {s.street}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/pages/mattress-store-locations" className="showroom-chip showroom-chip-link">
              All 5 LA showrooms →
            </Link>
          </li>
        </ul>
      </section>

      <section className="section showroom-guides" aria-labelledby="sd-guides-h">
        <div className="eyebrow">Read before you visit</div>
        <h2 id="sd-guides-h" className="h2">LA-local buying guides</h2>
        <ul className="showroom-chips" aria-label="LA mattress-shopping articles">
          <li>
            <Link href="/blogs/mattress-buying-guide/best-mattress-los-angeles" className="showroom-chip showroom-chip-link">
              Best mattress in Los Angeles (2026)
            </Link>
          </li>
          <li>
            <Link href="/blogs/mattress-buying-guide/mattress-store-near-me-los-angeles" className="showroom-chip showroom-chip-link">
              Mattress store near me, LA showrooms
            </Link>
          </li>
          <li>
            <Link href="/blogs/mattress-buying-guide/mattress-financing-options-los-angeles" className="showroom-chip showroom-chip-link">
              LA financing options (0% APR)
            </Link>
          </li>
          <li>
            <Link href="/blogs/mattress-buying-guide/how-to-choose-a-mattress" className="showroom-chip showroom-chip-link">
              How to choose a mattress
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}
