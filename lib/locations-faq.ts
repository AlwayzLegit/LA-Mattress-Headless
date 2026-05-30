/**
 * FAQ data for the /pages/mattress-store-locations index page.
 *
 * Phase 308 SEO audit (Semrush 20260530): the page was flagged with
 * 10,398 priority for `mattress stores near me` — engagement metrics
 * (time-on-page, low readability), missing related words competitors
 * carry, and `kw_stuffing_meta` (separately fixed by a description
 * override in lib/page-seo-overrides.ts).
 *
 * The FAQ block + FAQPage JSON-LD address two of those gaps:
 *   - Adds question-and-answer prose targeting natural "mattress
 *     stores near me" intent variants Semrush data flagged
 *   - Eligible for SERP rich-snippet Q&A expansion, lifting CTR on
 *     the position-1 result for that high-volume query
 *
 * Conventions match lib/mattress-sizes-data.ts:
 *   - Answers stay in the 40-500 char band (Google rich-snippet
 *     truncates at ~300; safe both directions)
 *   - Optional `link` becomes a trailing internal anchor in the
 *     rendered HTML and a "See: <url>" sentence in JSON-LD
 *   - Questions are written as a shopper would search them
 */

export type LocationsFaqItem = {
  q: string;
  a: string;
  link?: { href: string; label: string };
};

export const LOCATIONS_FAQ: LocationsFaqItem[] = [
  {
    q: 'Which LA Mattress store is closest to my neighborhood?',
    a: 'We have five Los Angeles showrooms across the city: Koreatown (Mid-City / DTLA), West LA (Santa Monica / Beverly Hills / Venice), La Brea (Hollywood / Hancock Park), Studio City (San Fernando Valley / Sherman Oaks), and Glendale (Burbank / Pasadena). The directory above sorts by distance once you share your ZIP — or scroll the map for the visual layout.',
  },
  {
    q: 'What time are LA Mattress stores open?',
    a: 'All five showrooms are open seven days a week. Most stores open at 10 AM and close at 8 PM Monday through Saturday, with Sunday hours of 11 AM to 7 PM. Hours can shift around holidays — each showroom card above shows that location\'s current "open today" status pulled live from our system.',
  },
  {
    q: 'Do I need an appointment to visit a mattress store?',
    a: 'No — walk in any day during open hours. Weekday mornings (10 AM to noon) are the quietest if you want an unhurried 30-to-60-minute session with a consultant. If you\'d rather book a dedicated time, call the showroom you want to visit and we\'ll reserve a sleep fitting.',
  },
  {
    q: 'Do you deliver to my LA neighborhood?',
    a: 'Free white-glove delivery is included across all of Los Angeles County on orders over $499 — Beverly Hills, Santa Monica, Hollywood, Downtown LA, Sherman Oaks, Burbank, Pasadena, Long Beach, and everywhere in between. Same-day delivery is available on most in-stock orders when you place the order by 4 PM.',
    link: { href: '/pages/mattress-store-delivery', label: 'See full delivery details' },
  },
  {
    q: 'What\'s the best mattress store in Los Angeles?',
    a: 'We\'re biased — but family-owned since 2012, 11,000+ verified reviews at 4.9 stars, five Greater LA locations, every major brand on the floor (Tempur-Pedic, Stearns & Foster, Helix, Diamond, plus our private-label collections), free same-day delivery, 120-night exchange, and salaried (not commissioned) sleep consultants. Visit and decide for yourself.',
    link: { href: '/pages/reviews', label: 'Read customer reviews' },
  },
  {
    q: 'Can I get same-day delivery from any of your mattress stores?',
    a: 'Yes — same-day white-glove delivery is available across Los Angeles County on most in-stock mattresses when ordered by 4 PM. We bring the bed in, set it on your frame, and haul the old mattress away at no extra cost. After 4 PM the order ships the next morning.',
  },
  {
    q: 'What should I bring to a mattress store visit?',
    a: 'Bring your own pillow if you can — head and neck alignment changes how a mattress feels under your shoulders. Wear comfortable clothes you can actually lie down in (skip the heavy coat). Bring your partner if you share the bed — motion isolation and firmness preferences only show up with two people on the bed. Allow 30 to 60 minutes for a proper test.',
  },
  {
    q: 'Which mattress brands do you carry in your LA stores?',
    a: 'Every showroom carries the same brand mix: Tempur-Pedic, Stearns & Foster, Helix, Diamond, Sealy, Chattam & Wells, Spring Air, Englander, Eastman House, Southerland, plus our private-label LA Mattress collections. Adjustable bases by Tempur-Pedic, Reverie, and Englander on demo at every store.',
    link: { href: '/pages/mattress-brands', label: 'See all brands' },
  },
  {
    q: 'Do you have a mattress store near Pasadena, Burbank, or the Valley?',
    a: 'Our Glendale showroom serves Pasadena, Burbank, La Cañada Flintridge, and the eastern San Fernando Valley — about 10–15 minutes from each. Our Studio City showroom covers Sherman Oaks, Studio City itself, North Hollywood, and the central / western Valley. Free white-glove delivery to all of these areas on orders over $499.',
  },
  {
    q: 'What if I don\'t love the mattress after I bring it home?',
    a: 'Every mattress comes with a 120-night Love Your Bed Guarantee — sleep on it for 30 days minimum to adjust, then if it isn\'t right, we\'ll swap it for a different model. No restocking fee, no return shipping cost. You only pay the price difference if you exchange up; nothing if you exchange down or to the same tier.',
    link: { href: '/pages/mattress-store-comfort-exchange', label: 'How the exchange works' },
  },
];
