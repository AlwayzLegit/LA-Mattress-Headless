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

import { findShowroom, type Showroom } from './showrooms.ts';

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
  {
    handle: 'mattress-store-west-hollywood',
    name: 'West Hollywood',
    geo: { latitude: 34.0900, longitude: -118.3617 },
    nearestShowroomHandles: ['best-mattress-store-la-brea', 'koreatown-best-mattress-store'],
    defaultBlurb:
      'West Hollywood mattress shoppers — our La Brea / Hancock Park showroom at 300 S La Brea Avenue is the closest physical store, about 7–10 minutes south via Fairfax or La Brea. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery covers all of WeHo — the Sunset Strip, Boystown, West Hollywood West, and the surrounding 90046, 90048, and 90069 zip codes — on orders over $499, same day if you order by 4pm, with setup and free haul-away of your old mattress. WeHo\'s condos and converted apartments often have tight elevators and stairwells; our delivery crews handle carry-up and tight-turn setups at no extra charge, and we stock low-profile foundations for platform beds and built-in frames. 0% APR financing through Synchrony or Acima, approved in under a minute.',
  },
  {
    handle: 'mattress-store-westwood',
    name: 'Westwood',
    geo: { latitude: 34.0633, longitude: -118.4456 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Shopping for a mattress in Westwood or near UCLA? Our West LA showroom at 10861 W Pico Boulevard is the closest store — about 8 minutes south on Westwood Boulevard or Veteran Avenue. The full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label lineup is on the floor, including the Twin XL and Full sizes that fit student apartments and dorm-style rooms. Free white-glove delivery to Westwood, Holmby Hills, Century City, and the surrounding 90024, 90025, and 90095 zip codes on orders over $499 — same day if you order by 4pm, setup and free haul-away included. Moving in for the school year? We deliver Twin XL and Full mattresses with low-profile foundations that work in UCLA-area apartments and high-rises, and we coordinate elevator-building deliveries by appointment. 0% APR financing through Synchrony / Acima available in-store and online.',
  },
  {
    handle: 'mattress-store-culver-city',
    name: 'Culver City',
    geo: { latitude: 34.0211, longitude: -118.3965 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Culver City mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is the closest physical store, about 10 minutes north via Overland or Sepulveda. We carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor, including the cooling gel memory foams and natural-latex Diamond models that suit warm Westside nights. Free white-glove delivery to Culver City, Mar Vista, Palms, and the surrounding 90230, 90232, and 90066 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Working at one of the Culver City studios or tech offices nearby? Order online and we\'ll schedule an evening or weekend delivery window. 0% APR financing through Synchrony and Acima, approved in under a minute.',
  },
  {
    handle: 'mattress-store-encino',
    name: 'Encino',
    geo: { latitude: 34.1597, longitude: -118.5012 },
    nearestShowroomHandles: ['mattress-store-studio-city'],
    defaultBlurb:
      'Encino residents — our Studio City showroom at 12306 Ventura Boulevard is the closest store, about 10 minutes east on Ventura Boulevard. The full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog is on the floor, with the cooling-gel and natural-latex options that hold up to the Valley\'s hot, dry summer nights. Free white-glove delivery to Encino, Tarzana, Lake Balboa, and the surrounding 91316, 91426, and 91436 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Encino\'s larger homes often want a King or California King on a split adjustable base; we keep both on the floor so you can try the zero-gravity and head-up presets before you buy. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-north-hollywood',
    name: 'North Hollywood',
    geo: { latitude: 34.1870, longitude: -118.3813 },
    nearestShowroomHandles: ['mattress-store-studio-city', 'mattress-store-in-glendale'],
    defaultBlurb:
      'NoHo mattress shoppers — you\'ve got two nearby LA Mattress showrooms: Studio City at 12306 Ventura Boulevard (8 minutes south over the hill) and Glendale at 201 N Central Avenue (12 minutes east on the 134). Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label lineup on the floor. Free white-glove delivery to North Hollywood, Valley Village, Sun Valley, and the surrounding 91601, 91602, and 91605 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Renting in one of the NoHo Arts District apartments? We stock low-profile foundations and bunkie boards for platform beds and tight ceiling heights, and our crews handle stair carry-up at no extra charge. 0% APR financing approved in under a minute.',
  },
  {
    handle: 'mattress-store-silver-lake',
    name: 'Silver Lake',
    geo: { latitude: 34.0869, longitude: -118.2702 },
    nearestShowroomHandles: ['koreatown-best-mattress-store', 'mattress-store-in-glendale'],
    defaultBlurb:
      'Silver Lake and Echo Park mattress shoppers — our Koreatown showroom at 201 S Western Avenue is the closest physical store, about 10 minutes southwest via Sunset or Beverly Boulevard. The Glendale store (201 N Central Avenue) is the runner-up if you\'re up near Atwater Village. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery to Silver Lake, Echo Park, Atwater Village, and the surrounding 90026, 90027, and 90039 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away. Silver Lake\'s hillside homes and vintage apartments often have steep stairs and narrow doorways; our crews handle tight carry-ins, and we stock bed-in-a-box options that fit through any entry. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-brentwood',
    name: 'Brentwood',
    geo: { latitude: 34.0522, longitude: -118.4737 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Brentwood mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is the closest physical store, about 10 minutes south via the 405 or Bundy Drive. We carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label collections on the floor, including the luxury hand-tufted and natural-latex builds Brentwood and Pacific Palisades shoppers tend to prefer. Free white-glove delivery to Brentwood, Pacific Palisades, and the surrounding 90049 and 90272 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Many Brentwood homes pair a King or California King with a split adjustable base; we keep both on the floor so you can try the zero-gravity and head-up presets in person. 0% APR financing through Synchrony or Acima, approved in under a minute.',
  },
  {
    handle: 'mattress-store-marina-del-rey',
    name: 'Marina del Rey',
    geo: { latitude: 33.9803, longitude: -118.4517 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Marina del Rey mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is the closest store, about 12 minutes north via Lincoln Boulevard or the 90. We carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label catalog on the floor, including the natural-latex Diamond models and cooling gel memory foams that hold up well to coastal humidity and warm marina nights. Free white-glove delivery to Marina del Rey, Playa del Rey, Playa Vista, and the surrounding 90292 and 90293 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away. Marina high-rises and apartments often have elevator and loading-dock rules; we coordinate appointment-based deliveries so your move-in goes smoothly. 0% APR financing through Synchrony / Acima available.',
  },
  {
    handle: 'mattress-store-los-feliz',
    name: 'Los Feliz',
    geo: { latitude: 34.1083, longitude: -118.2858 },
    nearestShowroomHandles: ['koreatown-best-mattress-store', 'mattress-store-in-glendale'],
    defaultBlurb:
      'Los Feliz mattress shoppers — our Koreatown showroom at 201 S Western Avenue is the closest physical store, about 8-10 minutes south via Western or Vermont Avenue. The Glendale store (201 N Central Avenue) is the runner-up if you\'re up near the hills. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery to Los Feliz, Franklin Hills, Los Feliz Village, and the surrounding 90027 and 90039 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Los Feliz\'s classic 1920s apartments and hillside homes often have narrow doorways and stairs; our crews handle tight carry-ins, and we stock bed-in-a-box options that fit through any entry. 0% APR financing available.',
  },
  {
    handle: 'mattress-store-eagle-rock',
    name: 'Eagle Rock',
    geo: { latitude: 34.1397, longitude: -118.2120 },
    nearestShowroomHandles: ['mattress-store-in-glendale'],
    defaultBlurb:
      'Eagle Rock mattress shoppers — our Glendale showroom at 201 N Central Avenue is the closest physical store, about 8 minutes north via the 134 or Colorado Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, with cooling-gel and natural-latex options for the warm northeast-LA summers. Free white-glove delivery to Eagle Rock, Highland Park, Glassell Park, and the surrounding 90041 and 90042 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Eagle Rock\'s craftsman homes and duplexes are a great fit for a queen or king on a platform frame; we stock low-profile foundations and bunkie boards for tight slat spacing. 0% APR financing through Synchrony / Acima, approved in under a minute.',
  },
  {
    handle: 'mattress-store-toluca-lake',
    name: 'Toluca Lake',
    geo: { latitude: 34.1517, longitude: -118.3534 },
    nearestShowroomHandles: ['mattress-store-studio-city', 'mattress-store-in-glendale'],
    defaultBlurb:
      'Toluca Lake mattress shoppers — our Studio City showroom at 12306 Ventura Boulevard is the closest physical store, about 6 minutes west on Ventura Boulevard. The Glendale store (201 N Central Avenue) is a close runner-up via the 134. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label lineup on the floor, including the cooling and natural-latex options that suit hot Valley nights. Free white-glove delivery to Toluca Lake, Toluca Woods, Cahuenga Pass, and the surrounding 91602 and 91505 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away. Toluca Lake\'s larger homes often want a King or California King with a split adjustable base; we keep both on the floor so you can test the presets. 0% APR financing through Synchrony or Acima.',
  },
  {
    handle: 'mattress-store-mid-wilshire',
    name: 'Mid-Wilshire',
    geo: { latitude: 34.0622, longitude: -118.3380 },
    nearestShowroomHandles: ['best-mattress-store-la-brea', 'koreatown-best-mattress-store'],
    defaultBlurb:
      'Mid-Wilshire mattress shoppers — our La Brea / Hancock Park showroom at 300 S La Brea Avenue is the closest physical store, about 5-7 minutes north via La Brea or Highland Avenue. Koreatown (201 S Western Avenue) is a close runner-up to the east. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery to Mid-Wilshire, Hancock Park, Miracle Mile, Larchmont, and the surrounding 90019, 90036, and 90048 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Mid-Wilshire\'s pre-war apartments and condos often have tight elevators; our crews handle carry-up and tight-turn setups at no extra charge. 0% APR financing through Synchrony / Acima, approved in under a minute.',
  },
  {
    handle: 'mattress-store-venice',
    name: 'Venice',
    geo: { latitude: 33.9850, longitude: -118.4695 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Venice mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is the closest physical store, about 12 minutes northeast via Venice Boulevard or Lincoln. We carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label collections on the floor, including the marine-air-friendly natural-latex Diamond models and cooling gel memory foams that hold up to coastal humidity and warm beach nights. Free white-glove delivery to Venice, Marina del Rey, Mar Vista, and the surrounding 90291 and 90292 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Venice\'s walk-street bungalows and converted lofts often have narrow access and stairs; our crews handle tight carry-ins, and we stock bed-in-a-box options that fit through any doorway. 0% APR financing through Synchrony / Acima available.',
  },
  {
    handle: 'mattress-store-highland-park',
    name: 'Highland Park',
    geo: { latitude: 34.1156, longitude: -118.1928 },
    nearestShowroomHandles: ['mattress-store-in-glendale', 'koreatown-best-mattress-store'],
    defaultBlurb:
      'Highland Park mattress shoppers — our Glendale showroom at 201 N Central Avenue is the closest physical store, about 12 minutes north via the 2 or York Boulevard. Koreatown (201 S Western Avenue) is the runner-up to the southwest. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery to Highland Park, Eagle Rock, Mount Washington, Garvanza, and the surrounding 90041 and 90042 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Highland Park\'s craftsman bungalows and hillside homes often have narrow doorways and stairs; our crews handle tight carry-ins, and we stock low-profile foundations and bunkie boards for platform beds. 0% APR financing through Synchrony / Acima, approved in under a minute.',
  },
  {
    handle: 'mattress-store-van-nuys',
    name: 'Van Nuys',
    geo: { latitude: 34.1866, longitude: -118.4487 },
    nearestShowroomHandles: ['mattress-store-studio-city'],
    defaultBlurb:
      'Van Nuys mattress shoppers — our Studio City showroom at 12306 Ventura Boulevard is the closest physical store, about 12 minutes south via Van Nuys Boulevard or the 405. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, with the cooling-gel and natural-latex options that hold up to the Valley\'s hot, dry summer nights. Free white-glove delivery to Van Nuys, Lake Balboa, Valley Glen, and the surrounding 91401, 91405, and 91411 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Renting a Van Nuys apartment? We stock low-profile foundations and bunkie boards that work for tight ceiling heights and platform beds, and our crews handle stair carry-up at no extra charge. 0% APR financing approved in under a minute.',
  },
  {
    handle: 'mattress-store-la-canada-flintridge',
    name: 'La Cañada Flintridge',
    geo: { latitude: 34.1989, longitude: -118.2009 },
    nearestShowroomHandles: ['mattress-store-in-glendale'],
    defaultBlurb:
      'La Cañada Flintridge mattress shoppers — our Glendale showroom at 201 N Central Avenue is the closest physical store, about 10 minutes south via the 2 Freeway or Verdugo Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, including the luxury hand-tufted and natural-latex builds La Cañada shoppers tend to prefer. Free white-glove delivery to La Cañada Flintridge, La Crescenta, Montrose, and the surrounding 91011 and 91020 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Many La Cañada homes pair a King or California King with a split adjustable base; we keep both on the floor so you can try the zero-gravity and head-up presets in person. 0% APR financing through Synchrony or Acima.',
  },
  {
    handle: 'mattress-store-mid-city',
    name: 'Mid-City',
    geo: { latitude: 34.0480, longitude: -118.3500 },
    nearestShowroomHandles: ['best-mattress-store-la-brea', 'koreatown-best-mattress-store'],
    defaultBlurb:
      'Mid-City mattress shoppers — our La Brea / Hancock Park showroom at 300 S La Brea Avenue is the closest physical store, about 7 minutes north via La Brea Avenue. Koreatown (201 S Western Avenue) is a close runner-up to the east. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery to Mid-City, West Adams, Arlington Heights, Pico-Robertson, and the surrounding 90016, 90019, and 90035 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Mid-City\'s 1920s duplexes and apartment courts often have narrow stairwells; our crews handle tight carry-ins, and we stock low-profile foundations for platform beds. 0% APR financing through Synchrony / Acima, approved in under a minute.',
  },
  {
    handle: 'mattress-store-tarzana',
    name: 'Tarzana',
    geo: { latitude: 34.1739, longitude: -118.5534 },
    nearestShowroomHandles: ['mattress-store-studio-city'],
    defaultBlurb:
      'Tarzana mattress shoppers — our Studio City showroom at 12306 Ventura Boulevard is the closest physical store, about 12 minutes east on Ventura Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, with the cooling-gel and natural-latex options that suit the Valley\'s hot summer nights. Free white-glove delivery to Tarzana, Encino, Reseda, and the surrounding 91335 and 91356 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Tarzana\'s larger homes south of the boulevard often want a King or California King on a split adjustable base; we keep both on the floor so you can test the zero-gravity and head-up presets before you buy. 0% APR financing through Synchrony / Acima.',
  },

  // ── Westside (served from West LA, 10861 W Pico Blvd) ──────────────
  {
    handle: 'mattress-store-mar-vista',
    name: 'Mar Vista',
    geo: { latitude: 34.0046, longitude: -118.4314 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Mar Vista mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is the closest store, about 8 minutes north via Centinela or Sawtelle. The full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label lineup is on the floor, including the natural-latex Diamond builds and cooling gel foams that hold up well to the Westside\'s marine-layer humidity. Free white-glove delivery to Mar Vista, Del Rey, Palms, and the surrounding 90066 and 90230 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away. Many of Mar Vista\'s 1940s bungalows and duplexes have tight doorways; our crews handle carry-in and we stock bed-in-a-box models that fit through any entry. 0% APR financing through Synchrony or Acima, approved in under a minute.',
  },
  {
    handle: 'mattress-store-palms',
    name: 'Palms',
    geo: { latitude: 34.0259, longitude: -118.4012 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Shopping for a mattress in Palms? Our West LA showroom at 10861 W Pico Boulevard is about 6 minutes away via National or Motor Avenue. We carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label catalog on the floor, including the Twin XL and Full sizes that fit Palms\' dense apartment buildings and the cooling memory foams renters here ask for. Free white-glove delivery to Palms, Cheviot Hills, Culver City, and the surrounding 90034 and 90064 zip codes on orders over $499 — same day if you order by 4pm, setup and free haul-away included. Palms is one of LA\'s most apartment-heavy neighborhoods; our crews handle elevator and tight-stairwell deliveries by appointment at no extra charge. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-century-city',
    name: 'Century City',
    geo: { latitude: 34.0583, longitude: -118.4156 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Century City mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is the closest store, about 7 minutes south via Avenue of the Stars and Pico. We carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label collections on the floor, including the luxury hand-tufted and cooling-gel builds that suit Century City\'s high-rise condos. Free white-glove delivery to Century City, Westwood, Beverly Hills, and the surrounding 90067 and 90024 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Century City towers have strict loading-dock and elevator rules; we coordinate appointment-based, certificate-of-insurance deliveries so building management signs off ahead of time. 0% APR financing through Synchrony or Acima, approved in under a minute.',
  },
  {
    handle: 'mattress-store-cheviot-hills',
    name: 'Cheviot Hills',
    geo: { latitude: 34.0383, longitude: -118.4015 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Cheviot Hills mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is barely 5 minutes away, just west on Pico past Motor. We carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label catalog on the floor, including the luxury euro-top and natural-latex models Cheviot Hills homeowners tend to prefer. Free white-glove delivery to Cheviot Hills, Rancho Park, Beverlywood, and the surrounding 90064 and 90034 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Cheviot Hills\' Spanish and Tudor homes often pair a King or California King with a split adjustable base; we keep both on the floor so you can test the zero-gravity presets in person. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-sawtelle',
    name: 'Sawtelle',
    geo: { latitude: 34.0353, longitude: -118.4453 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Sawtelle (Little Osaka) mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is about 5 minutes south via Sawtelle Boulevard or Olympic. The full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label lineup is on the floor, including the Twin XL and Full sizes that fit the area\'s apartments and the firm Japanese-style low-profile setups some shoppers ask for. Free white-glove delivery to Sawtelle, West LA, Mar Vista, and the surrounding 90025 and 90064 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away. Sawtelle\'s mid-century apartment courts often have narrow stairwells; our crews handle tight carry-ins, and we stock low-profile foundations and bunkie boards for platform beds. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-bel-air',
    name: 'Bel Air',
    geo: { latitude: 34.1003, longitude: -118.4595 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Bel Air mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is the closest store, about 12 minutes south via Sepulveda or the 405. We carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label collections on the floor, including the luxury hand-tufted, natural-latex, and cooling builds Bel Air estates tend to favor. Free white-glove delivery throughout Bel Air, Holmby Hills, and the surrounding 90077 and 90024 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Bel Air\'s gated estates and hillside drives can be tricky for delivery; we scout access ahead of time and schedule a precise window so the crew, the gate code, and your staff all line up. 0% APR financing through Synchrony or Acima.',
  },
  {
    handle: 'mattress-store-pacific-palisades',
    name: 'Pacific Palisades',
    geo: { latitude: 34.0356, longitude: -118.5156 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Pacific Palisades mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is the closest store, about 15 minutes via Sunset Boulevard or the 405 and Sunset. We carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label catalog on the floor, including the marine-air-friendly natural-latex Diamond models and cooling gel foams that handle coastal humidity and warm canyon nights. Free white-glove delivery to Pacific Palisades, the Highlands, Castellammare, and the surrounding 90272 zip code on orders over $499 — typically same or next day, with setup and free haul-away of your old mattress. Many Palisades homes pair a King or California King with a split adjustable base; we keep both on the floor for in-person testing. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-westchester',
    name: 'Westchester',
    geo: { latitude: 33.9580, longitude: -118.4001 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Westchester mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is the closest store, about 15 minutes north via Sepulveda or the 405. We carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label collections on the floor, including cooling gel foams for sleepers near LAX who run warm and the Twin XL / Full sizes that fit LMU-area apartments. Free white-glove delivery to Westchester, Playa del Rey, Playa Vista, and the surrounding 90045 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Flight crews and travelers in the area like our quiet, motion-isolating memory-foam and pocketed-coil hybrids for daytime sleep; they\'re all on the floor to try. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-playa-vista',
    name: 'Playa Vista',
    geo: { latitude: 33.9755, longitude: -118.4258 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Playa Vista mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is the closest store, about 12 minutes north via Jefferson or Lincoln. We carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label catalog on the floor, including the cooling gel and pocketed-coil hybrids that suit Playa Vista\'s modern apartments and the tech crowd in Silicon Beach. Free white-glove delivery to Playa Vista, Del Rey, Playa del Rey, and the surrounding 90094 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Playa Vista\'s mid-rise buildings have loading-dock and elevator-reservation rules; we book the slot with building management so move-in goes smoothly. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-playa-del-rey',
    name: 'Playa del Rey',
    geo: { latitude: 33.9542, longitude: -118.4386 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Playa del Rey mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is the closest store, about 15 minutes via Culver and Jefferson or Lincoln. We carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label collections on the floor, including the marine-air-friendly natural-latex Diamond builds and cooling gel foams that hold up to beachside humidity. Free white-glove delivery to Playa del Rey, Westchester, Marina del Rey, and the surrounding 90293 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away. PdR\'s bluff-top condos and beach apartments often have narrow stairs and tight elevators; our crews handle the carry-in, and we stock bed-in-a-box options that fit through any doorway. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-beverlywood',
    name: 'Beverlywood',
    geo: { latitude: 34.0461, longitude: -118.3953 },
    nearestShowroomHandles: ['best-mattress-store-west-la', 'best-mattress-store-la-brea'],
    defaultBlurb:
      'Beverlywood mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is about 8 minutes west via Pico, and the La Brea / Hancock Park store is a similar drive east. Both carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label catalog on the floor, including the luxury euro-top and natural-latex builds Beverlywood homeowners favor. Free white-glove delivery to Beverlywood, Pico-Robertson, Cheviot Hills, and the surrounding 90034 and 90035 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Many Beverlywood families want a King or split-King adjustable setup; we keep both on the floor so you can test the presets. 0% APR financing through Synchrony or Acima, approved in under a minute.',
  },
  {
    handle: 'mattress-store-pico-robertson',
    name: 'Pico-Robertson',
    geo: { latitude: 34.0533, longitude: -118.3836 },
    nearestShowroomHandles: ['best-mattress-store-west-la', 'best-mattress-store-la-brea'],
    defaultBlurb:
      'Pico-Robertson mattress shoppers — you have two nearby LA Mattress showrooms: West LA at 10861 W Pico Boulevard (9 minutes west on Pico) and La Brea / Hancock Park at 300 S La Brea Avenue (8 minutes north). Both carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label collections on the floor. Free white-glove delivery to Pico-Robertson, Beverlywood, Carthay, and the surrounding 90035 and 90048 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. The neighborhood\'s pre-war duplexes and apartments often have tight stairwells; our crews handle carry-up at no extra charge, and we stock low-profile foundations for platform beds and built-in frames. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-rancho-park',
    name: 'Rancho Park',
    geo: { latitude: 34.0388, longitude: -118.4198 },
    nearestShowroomHandles: ['best-mattress-store-west-la'],
    defaultBlurb:
      'Rancho Park mattress shoppers — our West LA showroom at 10861 W Pico Boulevard is right around the corner, about 4 minutes west on Pico. We carry the full Tempur-Pedic, Stearns & Foster, Diamond, Spring Air, Helix, and private-label catalog on the floor, including the cooling-gel and natural-latex builds that suit the area\'s single-family homes. Free white-glove delivery to Rancho Park, Cheviot Hills, Westwood, and the surrounding 90064 and 90025 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Being this close, Rancho Park shoppers often pop in to test a few finalists side by side, then have us deliver and set up the same evening. 0% APR financing through Synchrony or Acima, approved in under a minute.',
  },

  // ── Central / Mid-City (served from La Brea, 300 S La Brea Ave) ────
  {
    handle: 'mattress-store-fairfax',
    name: 'Fairfax',
    geo: { latitude: 34.0762, longitude: -118.3614 },
    nearestShowroomHandles: ['best-mattress-store-la-brea'],
    defaultBlurb:
      'Fairfax District mattress shoppers — our La Brea / Hancock Park showroom at 300 S La Brea Avenue is the closest store, about 4 minutes east via 3rd Street or Beverly. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery to the Fairfax District, Beverly Grove, Melrose, and the surrounding 90036 and 90048 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Fairfax\'s 1920s fourplexes and apartments often have narrow stairwells and tight elevators; our crews handle carry-up at no extra charge, and we stock low-profile foundations and bunkie boards for platform beds. 0% APR financing through Synchrony / Acima, approved in under a minute.',
  },
  {
    handle: 'mattress-store-miracle-mile',
    name: 'Miracle Mile',
    geo: { latitude: 34.0626, longitude: -118.3539 },
    nearestShowroomHandles: ['best-mattress-store-la-brea'],
    defaultBlurb:
      'Miracle Mile mattress shoppers — our La Brea / Hancock Park showroom at 300 S La Brea Avenue is just up the street, about 3 minutes north via La Brea or Wilshire. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery to Miracle Mile, Park La Brea, Mid-Wilshire, and the surrounding 90036 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Miracle Mile\'s art-deco towers and the Park La Brea complex have strict elevator and certificate-of-insurance rules; we coordinate appointment-based deliveries so building management signs off ahead of time. 0% APR financing through Synchrony / Acima, approved in under a minute.',
  },
  {
    handle: 'mattress-store-beverly-grove',
    name: 'Beverly Grove',
    geo: { latitude: 34.0762, longitude: -118.3760 },
    nearestShowroomHandles: ['best-mattress-store-la-brea'],
    defaultBlurb:
      'Beverly Grove mattress shoppers — our La Brea / Hancock Park showroom at 300 S La Brea Avenue is about 5 minutes east via 3rd Street or Beverly Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor, including cooling-gel and luxury euro-top builds. Free white-glove delivery to Beverly Grove, the Beverly Center area, West Hollywood, and the surrounding 90048 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. The neighborhood\'s condos and converted apartments near 3rd Street often have tight elevators; our crews handle carry-up and tight-turn setups at no extra charge. 0% APR financing through Synchrony or Acima, approved in under a minute.',
  },
  {
    handle: 'mattress-store-carthay',
    name: 'Carthay',
    geo: { latitude: 34.0617, longitude: -118.3712 },
    nearestShowroomHandles: ['best-mattress-store-la-brea'],
    defaultBlurb:
      'Carthay mattress shoppers — our La Brea / Hancock Park showroom at 300 S La Brea Avenue is the closest store, about 6 minutes via San Vicente or Olympic. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor, including the natural-latex and luxury hand-tufted builds that suit Carthay Circle\'s 1920s Spanish Revival homes. Free white-glove delivery to Carthay, Faircrest Heights, Pico-Robertson, and the surrounding 90048 and 90019 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Many Carthay homes have narrow doorways and original staircases; our crews handle tight carry-ins, and we stock bed-in-a-box options that fit through any entry. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-park-la-brea',
    name: 'Park La Brea',
    geo: { latitude: 34.0668, longitude: -118.3489 },
    nearestShowroomHandles: ['best-mattress-store-la-brea'],
    defaultBlurb:
      'Park La Brea mattress shoppers — our La Brea / Hancock Park showroom at 300 S La Brea Avenue is about 4 minutes away via 3rd Street. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor, including the Twin XL, Full, and Queen sizes that fit Park La Brea\'s towers and garden apartments. Free white-glove delivery throughout Park La Brea and the surrounding Miracle Mile 90036 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Park La Brea\'s management requires scheduled elevator reservations and a certificate of insurance for deliveries; we handle that paperwork and book your window so move-in is seamless. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-larchmont',
    name: 'Larchmont',
    geo: { latitude: 34.0780, longitude: -118.3243 },
    nearestShowroomHandles: ['best-mattress-store-la-brea', 'koreatown-best-mattress-store'],
    defaultBlurb:
      'Larchmont Village mattress shoppers — you have two nearby LA Mattress showrooms: La Brea / Hancock Park at 300 S La Brea Avenue (6 minutes west via Beverly) and Koreatown at 201 S Western Avenue (5 minutes southeast). Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery to Larchmont, Windsor Square, Hancock Park, and the surrounding 90004 and 90020 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Larchmont\'s classic homes near the Boulevard often want a King or California King with a split adjustable base; we keep both on the floor so you can test the presets in person. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-hancock-park',
    name: 'Hancock Park',
    geo: { latitude: 34.0726, longitude: -118.3370 },
    nearestShowroomHandles: ['best-mattress-store-la-brea', 'koreatown-best-mattress-store'],
    defaultBlurb:
      'Hancock Park mattress shoppers — our La Brea / Hancock Park showroom at 300 S La Brea Avenue serves your neighborhood directly, with Koreatown at 201 S Western Avenue a close second to the east. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor, including the luxury hand-tufted and natural-latex builds Hancock Park\'s historic estates favor. Free white-glove delivery throughout Hancock Park, Windsor Square, Larchmont, and the surrounding 90004 and 90020 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away. Many of the area\'s 1920s estates pair a King or California King with a split adjustable base; we keep both on the floor for in-person testing. 0% APR financing through Synchrony / Acima.',
  },

  // ── Central / Eastside (served from Koreatown, 201 S Western Ave) ──
  {
    handle: 'mattress-store-echo-park',
    name: 'Echo Park',
    geo: { latitude: 34.0782, longitude: -118.2606 },
    nearestShowroomHandles: ['koreatown-best-mattress-store', 'mattress-store-in-glendale'],
    defaultBlurb:
      'Echo Park mattress shoppers — our Koreatown showroom at 201 S Western Avenue is the closest store, about 10 minutes southwest via Beverly or Temple. The Glendale store is a runner-up if you\'re up by Elysian Park. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery to Echo Park, Elysian Heights, Historic Filipinotown, and the surrounding 90026 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Echo Park\'s hillside bungalows and vintage apartments often have steep stairs and narrow doorways; our crews handle tight carry-ins, and we stock bed-in-a-box models that fit through any entry. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-east-hollywood',
    name: 'East Hollywood',
    geo: { latitude: 34.0975, longitude: -118.2940 },
    nearestShowroomHandles: ['koreatown-best-mattress-store', 'best-mattress-store-la-brea'],
    defaultBlurb:
      'East Hollywood mattress shoppers — our Koreatown showroom at 201 S Western Avenue is the closest store, about 7 minutes south on Western Avenue. The La Brea / Hancock Park store is the runner-up to the west. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery to East Hollywood, Thai Town, Little Armenia, Virgil Village, and the surrounding 90027 and 90029 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. The area\'s 1920s courtyard apartments often have tight stairwells; our crews handle carry-up at no extra charge, and we stock low-profile foundations for platform beds. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-wilshire-center',
    name: 'Wilshire Center',
    geo: { latitude: 34.0617, longitude: -118.2998 },
    nearestShowroomHandles: ['koreatown-best-mattress-store'],
    defaultBlurb:
      'Wilshire Center mattress shoppers — our Koreatown showroom at 201 S Western Avenue is right in the neighborhood, about 4 minutes away via Wilshire or Western. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor, including the Twin XL, Full, and Queen sizes that fit Wilshire Center\'s dense mid-rise apartments. Free white-glove delivery to Wilshire Center, Koreatown, Windsor Square, and the surrounding 90010 and 90005 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. The high-rises along Wilshire have loading-dock and elevator-reservation rules; we book the slot with building management so your delivery lands without a hitch. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-westlake',
    name: 'Westlake',
    geo: { latitude: 34.0578, longitude: -118.2760 },
    nearestShowroomHandles: ['koreatown-best-mattress-store'],
    defaultBlurb:
      'Westlake mattress shoppers — our Koreatown showroom at 201 S Western Avenue is the closest store, about 7 minutes west via Wilshire or 6th Street. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor, including the budget-friendly innerspring and bed-in-a-box options popular with Westlake\'s renters, plus the Twin and Full sizes that fit smaller units. Free white-glove delivery to Westlake, MacArthur Park, Pico-Union, and the surrounding 90057 and 90006 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Many Westlake buildings have walk-up stairs; our crews handle the carry-up at no extra charge. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-windsor-square',
    name: 'Windsor Square',
    geo: { latitude: 34.0719, longitude: -118.3186 },
    nearestShowroomHandles: ['koreatown-best-mattress-store', 'best-mattress-store-la-brea'],
    defaultBlurb:
      'Windsor Square mattress shoppers — our Koreatown showroom at 201 S Western Avenue is about 5 minutes east, and the La Brea / Hancock Park store is a similar drive west via Beverly. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor, including the luxury euro-top and natural-latex builds Windsor Square\'s historic homes favor. Free white-glove delivery to Windsor Square, Hancock Park, Larchmont, and the surrounding 90004 and 90020 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. The neighborhood\'s grand 1910s–20s homes often pair a King or California King with a split adjustable base; we keep both on the floor for in-person testing. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-west-adams',
    name: 'West Adams',
    geo: { latitude: 34.0341, longitude: -118.3270 },
    nearestShowroomHandles: ['koreatown-best-mattress-store', 'best-mattress-store-la-brea'],
    defaultBlurb:
      'West Adams mattress shoppers — our Koreatown showroom at 201 S Western Avenue is the closest store, about 10 minutes north via Western or Arlington. The La Brea / Hancock Park store is a runner-up to the northwest. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery to West Adams, Arlington Heights, Jefferson Park, and the surrounding 90016 and 90018 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. West Adams\' restored Craftsman and Victorian homes often have narrow doorways and original staircases; our crews handle tight carry-ins, and we stock bed-in-a-box models that fit through any entry. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-pico-union',
    name: 'Pico-Union',
    geo: { latitude: 34.0466, longitude: -118.2840 },
    nearestShowroomHandles: ['koreatown-best-mattress-store'],
    defaultBlurb:
      'Pico-Union mattress shoppers — our Koreatown showroom at 201 S Western Avenue is the closest store, about 6 minutes north via Western and Pico. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor, including the value innerspring and bed-in-a-box options popular with Pico-Union families, plus Twin and Full sizes for shared and kids\' rooms. Free white-glove delivery to Pico-Union, Westlake, University Park, and the surrounding 90006 and 90007 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Many of the area\'s Victorian fourplexes have walk-up stairs; our crews handle the carry-up at no extra charge. 0% APR financing through Synchrony / Acima.',
  },

  // ── San Fernando Valley (served from Studio City, 12306 Ventura Blvd) ──
  {
    handle: 'mattress-store-valley-village',
    name: 'Valley Village',
    geo: { latitude: 34.1670, longitude: -118.3964 },
    nearestShowroomHandles: ['mattress-store-studio-city'],
    defaultBlurb:
      'Valley Village mattress shoppers — our Studio City showroom at 12306 Ventura Boulevard is the closest store, about 6 minutes north via Laurel Canyon Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, with the cooling-gel and natural-latex options that suit the Valley\'s hot summer nights. Free white-glove delivery to Valley Village, North Hollywood, Studio City, and the surrounding 91607 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Valley Village\'s mix of single-family homes and garden apartments works well with a Queen or King on a platform frame; we stock low-profile foundations and bunkie boards for tight slat spacing. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-reseda',
    name: 'Reseda',
    geo: { latitude: 34.2011, longitude: -118.5364 },
    nearestShowroomHandles: ['mattress-store-studio-city'],
    defaultBlurb:
      'Reseda mattress shoppers — our Studio City showroom at 12306 Ventura Boulevard is the closest store, about 18 minutes via Ventura and Reseda Boulevard or the 101. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, with the cooling-gel and value innerspring options that hold up to the West Valley\'s hot, dry summers. Free white-glove delivery to Reseda, Tarzana, Lake Balboa, and the surrounding 91335 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Reseda\'s ranch homes and apartments suit a Queen or King on a platform frame; we stock low-profile foundations and bunkie boards for tight ceiling heights. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-valley-glen',
    name: 'Valley Glen',
    geo: { latitude: 34.1869, longitude: -118.4267 },
    nearestShowroomHandles: ['mattress-store-studio-city'],
    defaultBlurb:
      'Valley Glen mattress shoppers — our Studio City showroom at 12306 Ventura Boulevard is the closest store, about 10 minutes north via Coldwater Canyon or Burbank Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, with the cooling-gel and natural-latex options that suit hot Valley nights. Free white-glove delivery to Valley Glen, Valley Village, Van Nuys, and the surrounding 91401 and 91606 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Students and staff near Valley College often want a Twin XL or Full with a low-profile foundation; we keep those on the floor and deliver same week. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-lake-balboa',
    name: 'Lake Balboa',
    geo: { latitude: 34.1869, longitude: -118.4945 },
    nearestShowroomHandles: ['mattress-store-studio-city'],
    defaultBlurb:
      'Lake Balboa mattress shoppers — our Studio City showroom at 12306 Ventura Boulevard is the closest store, about 15 minutes via the 101 and Balboa or Victory Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, with the cooling-gel and natural-latex options that handle the central Valley\'s hot summers. Free white-glove delivery to Lake Balboa, Van Nuys, Encino, and the surrounding 91406 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Lake Balboa\'s post-war ranch homes pair well with a Queen or King on a platform frame or split adjustable base; we keep both on the floor so you can test the presets. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-woodland-hills',
    name: 'Woodland Hills',
    geo: { latitude: 34.1684, longitude: -118.6059 },
    nearestShowroomHandles: ['mattress-store-studio-city'],
    defaultBlurb:
      'Woodland Hills mattress shoppers — our Studio City showroom at 12306 Ventura Boulevard is the closest LA Mattress store, about 20 minutes west via the 101 or Ventura Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, with the cooling-gel and natural-latex options that are a must for the West Valley\'s triple-digit summer heat. Free white-glove delivery to Woodland Hills, Tarzana, Canoga Park, and the surrounding 91364 and 91367 zip codes on orders over $499 — same or next day, with setup and free haul-away of your old mattress. Woodland Hills\' larger homes south of the Boulevard often want a King or California King on a split adjustable base; we keep both on the floor to try the zero-gravity presets. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-universal-city',
    name: 'Universal City',
    geo: { latitude: 34.1381, longitude: -118.3534 },
    nearestShowroomHandles: ['mattress-store-studio-city'],
    defaultBlurb:
      'Universal City mattress shoppers — our Studio City showroom at 12306 Ventura Boulevard is the closest store, about 6 minutes east via Ventura Boulevard or the 101. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, including cooling-gel hybrids and the Twin XL / Full sizes that fit the area\'s apartments and crew housing. Free white-glove delivery to Universal City, Studio City, Toluca Lake, and the surrounding 91608 and 91602 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Industry folks working nearby like our quiet, motion-isolating memory-foam and pocketed-coil hybrids for daytime sleep; they\'re all on the floor to test. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-canoga-park',
    name: 'Canoga Park',
    geo: { latitude: 34.2014, longitude: -118.5981 },
    nearestShowroomHandles: ['mattress-store-studio-city'],
    defaultBlurb:
      'Canoga Park mattress shoppers — our Studio City showroom at 12306 Ventura Boulevard is the closest LA Mattress store, about 22 minutes west via the 101 or Ventura Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, with the cooling-gel and value innerspring options that hold up to West Valley summers. Free white-glove delivery to Canoga Park, Winnetka, West Hills, and the surrounding 91303 and 91304 zip codes on orders over $499 — same or next day, with setup and free haul-away of your old mattress. Canoga Park\'s ranch homes and apartments suit a Queen or King on a platform frame; we stock low-profile foundations and bunkie boards for tight slat spacing. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-northridge',
    name: 'Northridge',
    geo: { latitude: 34.2381, longitude: -118.5301 },
    nearestShowroomHandles: ['mattress-store-studio-city'],
    defaultBlurb:
      'Northridge mattress shoppers — our Studio City showroom at 12306 Ventura Boulevard is the closest LA Mattress store, about 22 minutes via the 101 and 405 or Reseda Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, including the Twin XL and Full sizes CSUN students need and the cooling-gel hybrids that handle the north Valley\'s heat. Free white-glove delivery to Northridge, Porter Ranch, North Hills, and the surrounding 91324 and 91325 zip codes on orders over $499 — same or next day, with setup and free haul-away of your old mattress. Moving into CSUN-area housing? We deliver Twin XL and Full mattresses with low-profile foundations and coordinate apartment-building windows. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-panorama-city',
    name: 'Panorama City',
    geo: { latitude: 34.2242, longitude: -118.4495 },
    nearestShowroomHandles: ['mattress-store-studio-city', 'mattress-store-in-glendale'],
    defaultBlurb:
      'Panorama City mattress shoppers — our Studio City showroom at 12306 Ventura Boulevard is about 15 minutes south via the 405 or Van Nuys Boulevard, with Glendale a similar drive east via the 134 and 5. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, with cooling-gel and value innerspring options for hot Valley nights. Free white-glove delivery to Panorama City, Van Nuys, Arleta, and the surrounding 91402 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. The area\'s mid-century homes and apartments suit a Queen or King on a platform frame; we stock low-profile foundations for tight ceiling heights. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-sun-valley',
    name: 'Sun Valley',
    geo: { latitude: 34.2167, longitude: -118.3705 },
    nearestShowroomHandles: ['mattress-store-studio-city', 'mattress-store-in-glendale'],
    defaultBlurb:
      'Sun Valley mattress shoppers — our Studio City showroom at 12306 Ventura Boulevard is about 15 minutes south via the 170, and Glendale at 201 N Central Avenue is a similar drive east via the 134. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, with cooling-gel and value innerspring options for the northeast Valley\'s heat. Free white-glove delivery to Sun Valley, North Hollywood, Shadow Hills, and the surrounding 91352 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Sun Valley\'s ranch homes and larger lots suit a King or California King on a split adjustable base; we keep both on the floor so you can test the presets. 0% APR financing through Synchrony / Acima.',
  },

  // ── Northeast LA / Foothills (served from Glendale, 201 N Central Ave) ──
  {
    handle: 'mattress-store-atwater-village',
    name: 'Atwater Village',
    geo: { latitude: 34.1183, longitude: -118.2606 },
    nearestShowroomHandles: ['mattress-store-in-glendale', 'koreatown-best-mattress-store'],
    defaultBlurb:
      'Atwater Village mattress shoppers — our Glendale showroom at 201 N Central Avenue is the closest store, about 8 minutes north via Glendale Boulevard or San Fernando Road. Koreatown is a runner-up to the southwest. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery to Atwater Village, Glassell Park, Silver Lake, and the surrounding 90039 and 90065 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Atwater\'s 1920s Spanish bungalows and walk-street homes often have narrow doorways; our crews handle tight carry-ins, and we stock bed-in-a-box models that fit through any entry. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-montrose',
    name: 'Montrose',
    geo: { latitude: 34.2061, longitude: -118.2251 },
    nearestShowroomHandles: ['mattress-store-in-glendale'],
    defaultBlurb:
      'Montrose mattress shoppers — our Glendale showroom at 201 N Central Avenue is the closest store, about 12 minutes north via the 2 Freeway or Honolulu Avenue. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, including the luxury euro-top and natural-latex builds that suit Montrose\'s foothill homes. Free white-glove delivery to Montrose, La Crescenta, Verdugo City, and the surrounding 91020 and 91214 zip codes on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Many homes up in the Verdugo foothills pair a King or California King with a split adjustable base; we keep both on the floor so you can test the zero-gravity presets in person. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-la-crescenta',
    name: 'La Crescenta',
    geo: { latitude: 34.2342, longitude: -118.2387 },
    nearestShowroomHandles: ['mattress-store-in-glendale'],
    defaultBlurb:
      'La Crescenta mattress shoppers — our Glendale showroom at 201 N Central Avenue is the closest store, about 14 minutes north via the 2 Freeway or Foothill Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, including the luxury hand-tufted and natural-latex builds La Crescenta and Crescenta Highlands homeowners favor. Free white-glove delivery to La Crescenta, Montrose, La Cañada Flintridge, and the surrounding 91214 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. The area\'s foothill homes often want a King or California King on a split adjustable base; we keep both on the floor for in-person testing of the head-up and zero-gravity presets. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-tujunga',
    name: 'Tujunga',
    geo: { latitude: 34.2528, longitude: -118.2887 },
    nearestShowroomHandles: ['mattress-store-in-glendale'],
    defaultBlurb:
      'Tujunga mattress shoppers — our Glendale showroom at 201 N Central Avenue is the closest LA Mattress store, about 18 minutes north via the 210 Freeway or Foothill Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, with cooling-gel and value innerspring options that handle the foothills\' warm, dry summers. Free white-glove delivery to Tujunga, Sunland, Shadow Hills, and the surrounding 91042 zip code on orders over $499 — same or next day, with setup and free haul-away of your old mattress. Tujunga\'s rustic foothill homes and cabins often have narrow access roads and stairs; our crews scout the route ahead and handle tight carry-ins. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-sunland',
    name: 'Sunland',
    geo: { latitude: 34.2664, longitude: -118.3009 },
    nearestShowroomHandles: ['mattress-store-in-glendale'],
    defaultBlurb:
      'Sunland mattress shoppers — our Glendale showroom at 201 N Central Avenue is the closest LA Mattress store, about 20 minutes north via the 210 Freeway or Foothill Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, with cooling-gel and natural-latex options that suit the Foothills\' hot summers. Free white-glove delivery to Sunland, Tujunga, Shadow Hills, and the surrounding 91040 zip code on orders over $499 — same or next day, with setup and free haul-away of your old mattress. Sunland\'s equestrian and ranch-style properties suit a King or California King on a split adjustable base; we keep both on the floor so you can test the presets before you buy. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-south-pasadena',
    name: 'South Pasadena',
    geo: { latitude: 34.1161, longitude: -118.1503 },
    nearestShowroomHandles: ['mattress-store-in-glendale'],
    defaultBlurb:
      'South Pasadena mattress shoppers — our Glendale showroom at 201 N Central Avenue is the closest LA Mattress store, about 15 minutes east via the 134 and 110 or Colorado Boulevard. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, including the luxury euro-top and natural-latex builds South Pasadena\'s Craftsman homes favor. Free white-glove delivery to South Pasadena, San Marino, Highland Park, and the surrounding 91030 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. The area\'s restored 1900s–20s Craftsman and bungalow homes often have narrow doorways and original staircases; our crews handle tight carry-ins, and we stock bed-in-a-box models that fit through any entry. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-mount-washington',
    name: 'Mount Washington',
    geo: { latitude: 34.1011, longitude: -118.2178 },
    nearestShowroomHandles: ['mattress-store-in-glendale', 'koreatown-best-mattress-store'],
    defaultBlurb:
      'Mount Washington mattress shoppers — our Glendale showroom at 201 N Central Avenue is about 12 minutes north via San Fernando Road and the 2, with Koreatown a runner-up to the southwest. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery to Mount Washington, Glassell Park, Highland Park, and the surrounding 90065 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Mount Washington\'s steep hillside homes, narrow streets, and long staircases are some of the trickiest deliveries in LA; our crews scout access ahead of time and handle the carry-up, and we stock bed-in-a-box models that fit through any tight entry. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-glassell-park',
    name: 'Glassell Park',
    geo: { latitude: 34.1108, longitude: -118.2295 },
    nearestShowroomHandles: ['mattress-store-in-glendale', 'koreatown-best-mattress-store'],
    defaultBlurb:
      'Glassell Park mattress shoppers — our Glendale showroom at 201 N Central Avenue is the closest store, about 10 minutes north via San Fernando Road. Koreatown is a runner-up to the south. Both carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label collections on the floor. Free white-glove delivery to Glassell Park, Mount Washington, Atwater Village, and the surrounding 90065 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Glassell Park\'s hillside bungalows and hill-street homes often have stairs and narrow doorways; our crews handle tight carry-ins, and we stock bed-in-a-box options that fit through any entry. 0% APR financing through Synchrony / Acima, approved in under a minute.',
  },
  {
    handle: 'mattress-store-san-marino',
    name: 'San Marino',
    geo: { latitude: 34.1212, longitude: -118.1065 },
    nearestShowroomHandles: ['mattress-store-in-glendale'],
    defaultBlurb:
      'San Marino mattress shoppers — our Glendale showroom at 201 N Central Avenue is the closest LA Mattress store, about 18 minutes east via the 134 and 210 or Huntington Drive. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, including the luxury hand-tufted and natural-latex builds San Marino\'s estates favor. Free white-glove delivery to San Marino, South Pasadena, Pasadena, and the surrounding 91108 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Many San Marino homes pair a King or California King with a split adjustable base; we keep both on the floor so you can test the zero-gravity and head-up presets in person. 0% APR financing through Synchrony / Acima.',
  },
  {
    handle: 'mattress-store-altadena',
    name: 'Altadena',
    geo: { latitude: 34.1897, longitude: -118.1312 },
    nearestShowroomHandles: ['mattress-store-in-glendale'],
    defaultBlurb:
      'Altadena mattress shoppers — our Glendale showroom at 201 N Central Avenue is the closest LA Mattress store, about 18 minutes east via the 134 and 210 or Foothill. We carry the full Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Helix, and private-label catalog on the floor, including the luxury euro-top and natural-latex builds Altadena\'s foothill homes favor. Free white-glove delivery to Altadena, Pasadena, La Cañada Flintridge, and the surrounding 91001 zip code on orders over $499 — same day if you order by 4pm, with setup and free haul-away of your old mattress. Altadena\'s historic Craftsman and foothill homes often have stairs and narrow doorways; our crews handle tight carry-ins, and many homeowners here pair a King with a split adjustable base — both are on the floor to try. 0% APR financing through Synchrony / Acima.',
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

/**
 * Sibling neighborhoods that share at least one nearest showroom with the
 * given neighborhood (i.e. the other areas served by the same physical
 * store), excluding the neighborhood itself. Returned in NEIGHBORHOODS
 * order, capped at `limit`.
 *
 * Why this exists: the 27 neighborhood pages were a weak internal-link
 * hub — each earned only ~2 inbound links (the locations-index grid +
 * its covering showroom's "Neighborhoods we serve" list) and linked out
 * only to showrooms / the quiz, never to each other. Semrush flagged the
 * site's lowest thematic score on Linking (84) with crawl-depth /
 * one-internal-link / orphaned-page notices concentrated on under-linked
 * surfaces. Cross-linking neighborhoods that share a store turns the set
 * into a connected cluster (genuinely related: same showroom, same
 * delivery area) so link equity and crawl priority flow between them.
 */
export function getNearbyNeighborhoods(n: Neighborhood, limit = 6): Neighborhood[] {
  const showroomSet = new Set(n.nearestShowroomHandles);
  return NEIGHBORHOODS.filter(
    (other) =>
      other.handle !== n.handle &&
      other.nearestShowroomHandles.some((h) => showroomSet.has(h)),
  ).slice(0, limit);
}

/** Reverse lookup: all neighborhoods that list the given showroom handle
 *  among their nearest showrooms (primary or secondary). Powers the
 *  "Neighborhoods we serve" link list on each showroom detail page, so
 *  every neighborhood page earns a second, topically-relevant inbound
 *  link from the physical store that covers it — the first being the
 *  locations-index directory grid. Returns them in NEIGHBORHOODS order. */
export function getNeighborhoodsForShowroom(showroomHandle: string): Neighborhood[] {
  return NEIGHBORHOODS.filter((n) => n.nearestShowroomHandles.includes(showroomHandle));
}
