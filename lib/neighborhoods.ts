/**
 * LA neighborhoods served from one of the 5 physical showrooms.
 *
 * Phase 277e / SEO improvement plan Phase 6. Each entry below maps a
 * Shopify Page handle (which the merchant creates separately) to:
 *
 *   - a neighborhood name + geo for FurnitureStore JSON-LD `areaServed`
 *   - the 1–2 nearest physical showroom handles (linked via SHOWROOMS)
 *   - a default 150–250 word neighborhood-specific blurb the template
 *     uses when the merchant's Shopify Page body is empty
 *
 * The Shopify Page itself is created by the merchant — when a page with
 * one of these handles is published, `app/pages/[handle]/page.tsx`
 * automatically routes to the NeighborhoodPage template via
 * `findNeighborhood(handle)`. Until then the handle 404s, which is
 * correct (no half-built pages live in production).
 *
 * Why this instead of just 8 more entries in lib/showrooms.ts: a
 * Showroom is a real, physical store with an address + hours; a
 * neighborhood served from a different showroom has no own address
 * and shouldn't appear in the LocalBusiness `department` array on the
 * homepage. Distinct types keep both schemas accurate.
 *
 * Distances were eyeballed from a map — each neighborhood is linked to
 * the 1–2 showrooms within ~10–15 minutes' drive. Don't be precious
 * about which pair is "nearest"; the goal is for visitors to land on a
 * page that names their neighborhood and points them to a real store.
 */

import { findShowroom, type Showroom } from './showrooms';

export type Neighborhood = {
  /** Shopify Page handle. Merchant creates the page at /pages/{handle}. */
  handle: string;
  /** Display name ("Beverly Hills", "Downtown LA"). */
  name: string;
  /** Approximate centroid for FurnitureStore areaServed.geo (optional). */
  geo?: { latitude: number; longitude: number };
  /** Handles of the 1–2 nearest physical showrooms (see SHOWROOMS). */
  nearestShowroomHandles: string[];
  /**
   * Fallback intro blurb. Used as the page's body content (and the
   * meta description fallback) when the Shopify Page itself has no
   * body. Keep ≥150 words for "thin content" avoidance.
   */
  defaultBlurb: string;
};

export const NEIGHBORHOODS: Neighborhood[] = [
  {
    handle: 'mattress-store-beverly-hills',
    name: 'Beverly Hills',
    geo: { latitude: 34.0736, longitude: -118.4004 },
    nearestShowroomHandles: ['best-mattress-store-west-la', 'best-mattress-store-la-brea'],
    defaultBlurb:
      'Shopping for a mattress in Beverly Hills? Our West LA and La Brea showrooms are both a short drive from 90210 — 10 minutes via Wilshire Boulevard from the West LA store, 12 minutes via 3rd Street from La Brea / Hancock Park. Both carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, and Helix lineups on the floor, plus our private-label collections, with free white-glove delivery to Beverly Hills, Beverlywood, and the surrounding neighborhoods on orders over $499. Same-day delivery is available when you order by 4pm; financing through Synchrony and Acima is set up in-store or online. Come in to test models in person — Beverly Hills sleepers tend to prefer plush hybrids and the cooling memory foams; we keep both well-stocked. Call ahead if you want a dedicated 30-minute sleep fitting with one of our consultants.',
  },
  {
    handle: 'mattress-store-santa-monica',
    name: 'Santa Monica',
    geo: { latitude: 34.0195, longitude: -118.4912 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Looking for a mattress store near Santa Monica? Our West LA showroom at 10861 W Pico Boulevard is the closest physical store — about 10 minutes east on Pico, with free parking and the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label catalog on the floor. Free white-glove delivery covers Santa Monica, Venice, Mar Vista, and Brentwood on orders over $499 — same day if you order by 4pm, including setup and free haul-away of your old mattress. We carry the marine-air-friendly natural latex Diamond models that hold up well in coastal humidity, plus cooling gel memory foams for sleepers who run warm. Test everything in person, then we deliver and set up — no lifting on your end.',
  },
  {
    handle: 'mattress-store-downtown-la',
    name: 'Downtown LA',
    geo: { latitude: 34.0407, longitude: -118.2468 },
    nearestShowroomHandles: ['koreatown-best-mattress-store', 'best-mattress-store-la-brea'],
    defaultBlurb:
      'Downtown LA sleepers — our Koreatown store at 201 S Western Avenue is the closest physical showroom, about 10–15 minutes from DTLA depending on traffic. The La Brea / Hancock Park store is the runner-up if you\'re north of the 101. Both carry our full lineup: Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Eclipse, Helix, and our private-label collections. Free white-glove delivery to all DTLA zip codes (90012, 90013, 90014, 90015, 90017, 90021) on orders over $499 — same day if you order by 4pm, setup included, old mattress hauled away for free. Loft sleepers in Arts District / South Park: we have low-profile box springs and short-frame foundations that fit ceilings under 9 feet. 0% APR financing through Synchrony / Acima available.',
  },
  {
    handle: 'mattress-store-pasadena',
    name: 'Pasadena',
    geo: { latitude: 34.1478, longitude: -118.1445 },
    nearestShowroomHandles: ['mattress-store-in-glendale'],
    defaultBlurb:
      'Pasadena mattress shoppers — our Glendale showroom at 201 N Central Avenue is the closest physical store, roughly 10–12 minutes west on the 134 Freeway or Colorado Boulevard. Free white-glove delivery covers Pasadena, South Pasadena, San Marino, Altadena, Sierra Madre, and the surrounding San Gabriel Valley on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. The Glendale showroom has the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor; come test models in person, including the cooling-gel and natural-latex options that pair well with Pasadena\'s warmer summer nights. Financing through Synchrony and Acima is available in-store and online — approvals usually take under a minute.',
  },
  {
    handle: 'mattress-store-burbank',
    name: 'Burbank',
    geo: { latitude: 34.1808, longitude: -118.3090 },
    nearestShowroomHandles: ['mattress-store-studio-city', 'mattress-store-in-glendale'],
    defaultBlurb:
      'Burbank residents have two nearby LA Mattress showrooms: Studio City at 12306 Ventura Boulevard (8 minutes via the 134) and Glendale at 201 N Central Avenue (10 minutes east on the 134). Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Eclipse, Helix, and private-label lineup on the floor. Free white-glove delivery to Burbank, Toluca Lake, Magnolia Park, and the surrounding 91501–91506 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away. Studio types in Burbank apartments: we stock low-profile foundations + bunkie boards that work for tight ceiling heights and platform beds. 0% APR financing through Synchrony / Acima approved in under a minute.',
  },
  {
    handle: 'mattress-store-sherman-oaks',
    name: 'Sherman Oaks',
    geo: { latitude: 34.1511, longitude: -118.4490 },
    nearestShowroomHandles: ['mattress-store-studio-city'],
    defaultBlurb:
      'Sherman Oaks mattress shoppers — our Studio City showroom at 12306 Ventura Boulevard is right next door, 5–8 minutes east on Ventura Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor, with cooling-gel and natural-latex options that suit the Valley\'s hot summer nights. Free white-glove delivery to Sherman Oaks, Encino, Studio City, and the surrounding 91403–91423 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. 0% APR financing through Synchrony or Acima; both approve in under a minute online or in-store. Call ahead for a dedicated 30-minute sleep fitting if you want a consultant\'s full attention.',
  },
  {
    handle: 'mattress-store-hollywood',
    name: 'Hollywood',
    geo: { latitude: 34.0928, longitude: -118.3287 },
    nearestShowroomHandles: ['best-mattress-store-la-brea', 'koreatown-best-mattress-store'],
    defaultBlurb:
      'Hollywood mattress stores — our La Brea / Hancock Park showroom at 300 S La Brea Avenue is the closest physical store, 6–8 minutes south of Hollywood Boulevard. Koreatown is the runner-up if you\'re east of Highland. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Eclipse, Helix, and private-label catalog on the floor. Free white-glove delivery covers Hollywood, West Hollywood, Los Feliz, Larchmont, and the surrounding 90028, 90038, 90046, 90068 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Apartment-dweller-friendly: low-profile foundations and short bunkie boards for tight ceiling heights; we also handle stair carry-up at no extra charge. 0% APR financing available.',
  },
  {
    handle: 'mattress-store-long-beach',
    name: 'Long Beach',
    geo: { latitude: 33.7701, longitude: -118.1937 },
    nearestShowroomHandles: ['best-mattress-store-west-la', 'koreatown-best-mattress-store'],
    defaultBlurb:
      'Long Beach mattress shoppers — Long Beach is a 25–35 minute drive from our nearest showrooms (West LA via the 405, Koreatown via the 110), so plan a single visit and we\'ll handle delivery for the rest. Both showrooms carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Eclipse, Helix, and private-label catalog on the floor. Free white-glove delivery to Long Beach, Belmont Shore, Bixby Knolls, Signal Hill, and the surrounding 90801–90815 zip codes on orders over $499 — typically next-day from Long Beach (same-day if you order before noon and we have a slot). Coastal-friendly options: natural-latex Diamond models that handle marine humidity well, plus cooling gel memory foams for summer nights. 0% APR financing through Synchrony / Acima, approved in under a minute.',
  },
];

export function findNeighborhood(handle: string): Neighborhood | undefined {
  return NEIGHBORHOODS.find((n) => n.handle === handle);
}

/** Hydrate the showroom handles into full Showroom records. Drops any
 *  unknown handles silently (a data-entry typo above should fail closed,
 *  not crash the template). */
export function getNearestShowrooms(n: Neighborhood): Showroom[] {
  return n.nearestShowroomHandles
    .map((h) => findShowroom(h))
    .filter((s): s is Showroom => Boolean(s));
}
