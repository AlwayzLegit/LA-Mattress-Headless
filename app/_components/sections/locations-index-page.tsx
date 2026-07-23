import Link from 'next/link';

import type { Page } from '@/lib/shopify/types';
import { SHOWROOMS, findShowroom } from '@/lib/showrooms';
import { NEIGHBORHOODS } from '@/lib/neighborhoods';
import { LOCATIONS_FAQ } from '@/lib/locations-faq';
import { getStorefrontReviews, reviewerName } from '@/lib/judgeme';
import { stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY, SITE_URL } from '@/lib/site-config';
import { Icon } from '@/app/_components/icon';
import { LocationsFinder } from '@/app/_components/sections/locations-finder';
import { ShowroomsMap } from '@/app/_components/sections/showrooms-map';

/**
 * `/pages/mattress-store-locations` hub template. Extracted from
 * app/(storefront)/pages/[handle]/page.tsx (deep audit codeq-godfile-01)
 * — pure move, no behavior change.
 */
export async function LocationsIndexPage({ page }: { page: Page }) {
  // Pull 3 sitewide top reviews for social proof on the page. Judge.me
  // tags reviews to products, not locations, so the snippets are brand-
  // wide rather than per-showroom — still real customer voices. Falls
  // back to an empty array when Judge.me isn't configured / errors.
  const recentReviews = await getStorefrontReviews({ perPage: 3, minRating: 5 });

  // Human-readable list of the five showroom areas ("A, B, C, D, and E")
  // for the answer-first summary block. Built from SHOWROOMS so it stays
  // in sync if a location is added or removed.
  const showroomAreas = SHOWROOMS.map((s) => s.area);
  const areaList =
    showroomAreas.length > 1
      ? `${showroomAreas.slice(0, -1).join(', ')}, and ${showroomAreas[showroomAreas.length - 1]}`
      : showroomAreas[0];

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
            Looking for a mattress store near you? We have five across Los Angeles, try every mattress in person at any showroom, open daily, no appointment needed. Free white-glove delivery, 120-night comfort exchange, and 0% APR financing at every location.
          </p>
        </header>

        {/* Answer-first summary. The 20260621 keyword audit found
            "mattress store near me" (110K vol) had dropped out of the
            top 100, split across two competing URLs. This consolidates
            the canonical, extractable answer on the locations hub so AI
            Overviews + featured snippets cite this page for the
            "how many / where are your stores" intent. */}
        <section className="qa-box" aria-labelledby="loc-tldr-h">
          <h2 id="loc-tldr-h" className="qa-box-h">Where are LA Mattress Store&rsquo;s showrooms?</h2>
          <p>
            LA Mattress Store has <strong>five mattress stores across Los Angeles</strong>, in {areaList}.
            Every showroom is open daily with no appointment needed, carries 30+ mattresses from Tempur-Pedic
            to Helix in every size, and includes free same-day white-glove delivery across LA County.
          </p>
        </section>

        <section className="locations-trust" aria-label="What every showroom offers">
          <div className="locations-trust-item">
            <Icon name="truck" size={18} />
            <div>
              <div className="locations-trust-title">Free LA delivery</div>
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
              <div className="locations-trust-sub">Synchrony &amp; Acima, instant approval</div>
            </div>
          </div>
        </section>

        {/*
          Multi-showroom map. Uses Google Maps' legacy `output=embed`
          URL, works without a Maps Embed API key, which we don't have
          configured in env. Brand-query mode surfaces all 5 GBP-verified
          listings as numbered pins centered on Los Angeles. loading="lazy"
          + explicit dimensions reserves layout space so the iframe
          doesn't contribute to CLS, and importance="low" tells the
          browser this is non-critical (mobile users may never scroll to
          it). title is required for a11y on iframes.
        */}
        <div style={{ marginTop: 'var(--s-7)' }}>
          <ShowroomsMap />
        </div>

        {/* Showroom directory + ZIP/geolocation finder. Client component
            owns the directory rendering so it can re-sort + annotate
            cards with distance once the shopper provides coordinates.
            Server passes the static showroom array down; no per-request
            geocoding cost. */}
        <LocationsFinder showrooms={SHOWROOMS} />

        {/* "Walk in today" evergreen perks strip. Three reasons to
            visit right now rather than later, lifted from the trust
            strip but framed as immediate-action ("walk in", "today",
            "now") rather than passive guarantees. Sits directly under
            the directory because it answers the natural follow-up
            question once a shopper has picked a closest showroom. */}
        <section className="locations-perks" aria-label="Reasons to visit a showroom today">
          <div className="locations-perks-item">
            <div className="locations-perks-eyebrow">No appointment</div>
            <p>Walk in any day during open hours. Weekday mornings are quietest.</p>
          </div>
          <div className="locations-perks-item">
            <div className="locations-perks-eyebrow">Same-day delivery</div>
            <p>Order by 4 PM and we&rsquo;ll deliver, set up, and haul away your old mattress tonight.</p>
          </div>
          <div className="locations-perks-item">
            <div className="locations-perks-eyebrow">Lie on every brand</div>
            <p>Compare Tempur-Pedic, Stearns &amp; Foster, Helix, Sealy, and 6 more, all on the floor.</p>
          </div>
        </section>

        {/* What to expect + Plan your visit. Two substantive panels
            under the showroom directory, addresses the "page brings
            no value beyond a list" feedback. Industry-standard
            pattern (Sleep Number, Mattress Firm, Casper all carry
            equivalent "what to expect" copy on their store-finder
            pages because shoppers showing up to a brick-and-mortar
            often haven't visited a mattress showroom before). */}
        <section className="locations-context" aria-label="What to expect at our showrooms">
          <div className="locations-context-panel">
            <h2>What every showroom has</h2>
            <ul>
              <li><strong>30+ mattresses on the floor</strong> from Tempur-Pedic, Stearns &amp; Foster, Sealy, Chattam &amp; Wells, Spring Air, Diamond, Englander, Eastman House, Helix, and Harvest, every bed in our catalog, every size.</li>
              <li><strong>Sleep consultants trained on every brand</strong>, no upsell pressure, no &ldquo;you really need the premium one.&rdquo; They&rsquo;ll narrow you down by sleep position, body weight, and back history.</li>
              <li><strong>Side-by-side comparison setup</strong>, pull two or three finalists together and switch between them in a single session.</li>
              <li><strong>Adjustable bases on demo</strong> with every mattress so you can test what zero-gravity and head-up actually feel like before you buy.</li>
              <li><strong>Same-day white-glove delivery</strong> anywhere in LA when you order by 4 PM, setup and old-mattress removal included.</li>
              <li><strong>0% APR financing</strong> through Synchrony or Acima, instant decision at the counter, bring a driver&rsquo;s license.</li>
            </ul>
          </div>
          <div className="locations-context-panel">
            <h2>Plan your visit</h2>
            <ul>
              <li><strong>Allow 30 to 60 minutes</strong> for a thorough test. Lying down for 5–10 minutes per bed in your sleep position beats any spec sheet, and a back-to-back comparison sharpens the right answer fast.</li>
              <li><strong>Bring your usual pillow</strong> if you can, head-and-neck alignment changes how a mattress feels under your shoulders.</li>
              <li><strong>Wear comfortable clothes</strong> you can actually lie down in. Skip the heavy coat.</li>
              <li><strong>No appointment needed.</strong> Walk in any day during open hours; weekday mornings are quietest if you want a long unhurried session.</li>
              <li><strong>Bring your partner</strong> if you share the bed. Motion isolation and firmness preferences only show up when both of you are on the bed at once.</li>
              <li><strong>Accessible at every location</strong>, wheelchair-accessible entrance, parking on-site or street, ADA-compliant facilities. Call ahead if you need help loading a mattress into a vehicle.</li>
            </ul>
          </div>
        </section>

        {/* Customer voices, three sitewide top reviews as social proof
            on the locations page. Judge.me reviews are product-tagged,
            not location-tagged, so these are brand-wide rather than
            per-showroom. Only renders when Judge.me returns results
            (no empty state, better to omit the section than show
            placeholder copy). */}
        {recentReviews.length > 0 ? (
          <section className="locations-reviews" aria-label="Customer reviews">
            <header className="locations-reviews-head">
              <h2 className="h2">What shoppers say after visiting</h2>
              <Link href="/pages/reviews" className="link-arrow">
                Read all reviews <Icon name="arrow-right" size={14} />
              </Link>
            </header>
            <ul className="locations-reviews-grid" role="list">
              {recentReviews.map((r) => {
                const date = new Date(r.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                });
                return (
                  <li key={r.id} className="locations-review-card">
                    <div className="locations-review-stars" aria-label={`${r.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <span
                          key={i}
                          className={i < Math.round(r.rating) ? 'locations-review-star-on' : 'locations-review-star-off'}
                          aria-hidden="true"
                        >
                          <Icon name="star" size={14} />
                        </span>
                      ))}
                    </div>
                    {r.title ? <p className="locations-review-title">{r.title}</p> : null}
                    <p className="locations-review-body">&ldquo;{r.body}&rdquo;</p>
                    <p className="locations-review-meta muted">
                      <span>{reviewerName(r, 'Verified buyer')}</span>
                      <span>·</span>
                      <time dateTime={r.created_at}>{date}</time>
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* "Why visit a showroom" was previously a long paragraph + bullet
            list here. Both moved into the structured locations-context
            panels above (What every showroom has + Plan your visit), so
            the prose isn't repeated. The remaining sections below are
            the next-step CTA + SEO cross-links to pillar articles. */}

        <section className="section" style={{ marginTop: 'var(--s-6)' }}>
          <h2 className="h2">Not sure where to start?</h2>
          <p className="muted" style={{ maxWidth: '60ch' }}>
            Take our <Link href="/sleep-quiz">2-minute sleep quiz</Link> for a category recommendation, then come into the closest showroom to lie on the top picks. Or call us at{' '}
            <a href={`tel:${SITE_PHONE_TEL}`} className="tnum">{SITE_PHONE_DISPLAY}</a>, we&rsquo;ll help you pick over the phone and book delivery the same day.
          </p>
        </section>

        {/* SEMrush 20260521_1: surface the LA-pillar articles from the
            locations index, high-PageRank page that previously had no
            outbound link to the new buying guides. Pulls each pillar
            ~one click closer to root. */}
        <section className="section" style={{ marginTop: 'var(--s-6)' }}>
          <h2 className="h2">Read before you visit</h2>
          <ul style={{ maxWidth: '60ch', paddingLeft: 'var(--s-5)' }}>
            <li style={{ marginBottom: 'var(--s-2)' }}>
              <Link href="/blogs/mattress-buying-guide/best-mattress-los-angeles">Best mattress in Los Angeles (2026 guide)</Link>
              {' '}, a tour of the brands and price tiers we stock and who they fit.
            </li>
            <li style={{ marginBottom: 'var(--s-2)' }}>
              <Link href="/blogs/mattress-buying-guide/mattress-store-near-me-los-angeles">Mattress store near me, LA showrooms guide</Link>
              {' '}, which showroom matches which LA neighborhood.
            </li>
            <li style={{ marginBottom: 'var(--s-2)' }}>
              <Link href="/blogs/mattress-buying-guide/mattress-financing-options-los-angeles">LA mattress financing, 0% APR options</Link>
              {' '}, Synchrony, Acima, Affirm/Klarna alternatives, and lay-away math.
            </li>
            <li style={{ marginBottom: 'var(--s-2)' }}>
              <Link href="/blogs/mattress-buying-guide/how-to-choose-a-mattress">How to choose a mattress</Link>
              {' '}, our showroom-tested decision framework by sleep style.
            </li>
          </ul>
        </section>

        {/* Phase 308 SEO PR, neighborhood directory. Each entry in
            lib/neighborhoods.ts maps a Shopify Page handle to its
            nearest physical showroom(s). Listing them here gives
            high-volume LA neighborhood queries ("mattress store
            beverly hills", "mattress store sherman oaks", etc.) a
            dedicated link target on the locations index, which both
            distributes PageRank to those long-tail URLs and answers
            the "do you serve my neighborhood" question in scannable
            grid form. The neighborhood data also includes the
            nearest-showroom mapping, surfaced inline so a shopper
            who clicks knows which physical store covers them. */}
        <section className="section locations-neighborhoods" aria-labelledby="locations-neighborhoods-h" style={{ marginTop: 'var(--s-6)' }}>
          <h2 id="locations-neighborhoods-h" className="h2">Mattress stores by LA neighborhood</h2>
          <p className="muted" style={{ maxWidth: '60ch' }}>
            Shopping for a mattress in a specific Los Angeles neighborhood? Each area below is served by one of our five physical showrooms, with the same brand mix, same delivery coverage, and same pricing.
          </p>
          <ul className="locations-neighborhoods-grid" role="list">
            {NEIGHBORHOODS.map((n) => {
              const nearest = findShowroom(n.nearestShowroomHandles[0]);
              return (
                <li key={n.handle} className="locations-neighborhood-card">
                  <Link href={`/pages/${n.handle}`} className="locations-neighborhood-name">
                    {n.name} mattress store
                  </Link>
                  {nearest ? (
                    <p className="locations-neighborhood-nearest muted">
                      Served from <Link href={`/pages/${nearest.handle}`}>{nearest.area}</Link>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Phase 308 SEO PR, FAQ. Targets the "mattress stores near
            me" intent variants Semrush flagged as missing related
            words on this URL. The same 10 Q&A items feed the
            FAQPage JSON-LD below for SERP rich-snippet eligibility.
            Data in lib/locations-faq.ts. */}
        <section className="section locations-faq" aria-labelledby="locations-faq-h" style={{ marginTop: 'var(--s-6)' }}>
          <h2 id="locations-faq-h" className="h2">Mattress store FAQs</h2>
          <p className="muted" style={{ maxWidth: '60ch' }}>
            The questions shoppers ask before walking in, answered.
          </p>
          <div className="ms-faq-list">
            {LOCATIONS_FAQ.map((item) => (
              <details key={item.q} className="ms-faq-item">
                <summary className="ms-faq-q">{item.q}</summary>
                <div className="ms-faq-a">
                  <p>
                    {item.a}
                    {item.link ? (
                      <>
                        {' '}
                        <Link href={item.link.href}>{item.link.label}</Link>.
                      </>
                    ) : null}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </section>
      </article>

      <script
        id="ld-faq-mattress-store-locations"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: LOCATIONS_FAQ.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: {
                '@type': 'Answer',
                text: item.link
                  ? `${item.a} See: ${SITE_URL}${item.link.href}`
                  : item.a,
              },
            })),
          }),
        }}
      />
    </main>
  );
}
