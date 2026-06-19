/**
 * Reference data for the dedicated `/pages/mattress-sizes` template.
 *
 * Phase 308 SEO audit (Semrush 20260530): the page was flagged with
 * 21,599 priority points across 17 distinct target keywords (the
 * single biggest priority concentration in the audit). Most of the
 * flagged keywords are dimension-format variants the merchant body
 * doesn't cover precisely — e.g. "bed dimensions feet" (the body
 * lists inches only), "60x80 bed size" (queen size, but only spelled
 * with " × " in the body's chart), "king size measurement mattress",
 * "size twin bed dimensions". Listing every dimension format up front
 * + answering the size-comparison questions in JSON-LD-eligible
 * FAQ form covers the gap without bloating the merchant body.
 *
 * SIZES — the canonical seven sizes LA Mattress stocks, with every
 * dimension format Semrush flagged: inches (the standard), feet (US
 * room-planning convention), and centimeters (international, also
 * what some bedding makers spec). Plus the "best for" sleeper profile
 * and the smallest realistic bedroom size in feet (room-size queries
 * Semrush also flagged).
 *
 * FAQ_ITEMS — covers every Semrush-flagged keyword variant in
 * question-and-answer form, both for human readers and FAQPage
 * JSON-LD. Anchor href on every answer where it'd surface a
 * cross-link to a size-specific collection.
 */

export type MattressSize = {
  /** Display name as people say it ("Twin XL", not "twin_xl"). */
  name: string;
  /** Inches as "W × L" — primary SEO dimension format. */
  inches: string;
  /** Feet as "W × L" — covers "bed dimensions feet" Semrush keyword. */
  feet: string;
  /** Centimeters as "W × L" — international. */
  cm: string;
  /** One-line "who it fits" — drives the "best for" search intent. */
  bestFor: string;
  /** Minimum realistic room in feet, e.g. "9 × 10 ft". */
  minRoom: string;
  /** Link target on the size's name + "Shop X" CTA. */
  collectionHref: string;
  /** Footprint width in inches — drives the to-scale size diagram. */
  wIn: number;
  /** Footprint length in inches — drives the to-scale size diagram. */
  lIn: number;
  /** Sleeper silhouettes to draw on the bed (1 = solo, 2 = couple). */
  sleepers: 1 | 2;
};

export const MATTRESS_SIZES: MattressSize[] = [
  {
    name: 'Twin',
    inches: '38" × 75"',
    feet: '3 ft 2 in × 6 ft 3 in',
    cm: '96.5 × 190.5 cm',
    bestFor: 'Kids, single adults, guest rooms',
    minRoom: '7 × 10 ft',
    collectionHref: '/collections/twin-size-mattresses',
    wIn: 38,
    lIn: 75,
    sleepers: 1,
  },
  {
    name: 'Twin XL',
    inches: '38" × 80"',
    feet: '3 ft 2 in × 6 ft 8 in',
    cm: '96.5 × 203 cm',
    bestFor: 'Tall single sleepers, college dorms',
    minRoom: '7 × 10 ft',
    collectionHref: '/collections/twin-xl-mattress-sale',
    wIn: 38,
    lIn: 80,
    sleepers: 1,
  },
  {
    name: 'Full',
    inches: '54" × 75"',
    feet: '4 ft 6 in × 6 ft 3 in',
    cm: '137 × 190.5 cm',
    bestFor: 'Solo sleepers who want space, smaller couples',
    minRoom: '9 × 10 ft',
    collectionHref: '/collections/full-size-mattresses',
    wIn: 54,
    lIn: 75,
    sleepers: 1,
  },
  {
    name: 'Queen',
    inches: '60" × 80"',
    feet: '5 ft × 6 ft 8 in',
    cm: '152 × 203 cm',
    bestFor: 'Most couples, single sleepers who like room',
    minRoom: '10 × 10 ft',
    collectionHref: '/collections/queen-size-mattresses',
    wIn: 60,
    lIn: 80,
    sleepers: 2,
  },
  {
    name: 'King',
    inches: '76" × 80"',
    feet: '6 ft 4 in × 6 ft 8 in',
    cm: '193 × 203 cm',
    bestFor: 'Couples who want shoulder-room, kids/pets in bed',
    minRoom: '12 × 12 ft',
    collectionHref: '/collections/king-size-mattresses',
    wIn: 76,
    lIn: 80,
    sleepers: 2,
  },
  {
    name: 'California King',
    inches: '72" × 84"',
    feet: '6 ft × 7 ft',
    cm: '183 × 213 cm',
    bestFor: 'Taller sleepers (over 6 ft), long-narrow bedrooms',
    minRoom: '12 × 14 ft',
    collectionHref: '/collections/california-king-mattresses',
    wIn: 72,
    lIn: 84,
    sleepers: 2,
  },
  {
    name: 'Split King',
    inches: 'Two 38" × 80"',
    feet: 'Two 3 ft 2 in × 6 ft 8 in',
    cm: 'Two 96.5 × 203 cm',
    bestFor: 'Adjustable-base couples, different firmness needs',
    minRoom: '12 × 12 ft',
    collectionHref: '/collections/split-king-mattresses',
    wIn: 76,
    lIn: 80,
    sleepers: 2,
  },
];

/**
 * Specialty, RV & camper sizes — non-standard dimensions shoppers
 * search for constantly (SEMrush 20260612 ideas: "camper mattress",
 * "measure your rv", "60 x 75", "custom size" all flagged as missing
 * from /pages/mattress-sizes). Kept SEPARATE from MATTRESS_SIZES so
 * the standard-size scale diagram, comparison cards, and the
 * article-enrichment dimension tables don't grow odd rows — these
 * render only in the specialty section of the sizes hub.
 *
 * RV dimensions vary by manufacturer more than residential sizes do;
 * the `inches` column carries the most common spec and the section
 * copy tells shoppers to measure their platform before ordering.
 */
export type SpecialtySize = {
  name: string;
  inches: string;
  /** Where it's typically found / who it fits. */
  usedIn: string;
  /** Optional deep-dive article. */
  guideHref?: string;
  guideLabel?: string;
};

export const SPECIALTY_SIZES: SpecialtySize[] = [
  {
    name: 'Short Queen (RV Queen)',
    inches: '60" × 74–75"',
    usedIn: 'RVs, campers, and fifth wheels — queen width, 5–6 inches shorter',
    guideHref: '/blogs/mattress-buying-guide/short-queen-mattresses-for-campers-how-to-measure-and-buy-right',
    guideLabel: 'Short queen RV guide',
  },
  {
    name: 'RV King',
    inches: '72" × 75–80"',
    usedIn: 'Larger RVs and fifth wheels — between a queen and a residential king',
  },
  {
    name: 'RV Bunk',
    inches: '28–35" × 75–80"',
    usedIn: 'RV bunk areas — widths vary by floor plan, so measure before buying',
  },
  {
    name: 'Full XL',
    inches: '54" × 80"',
    usedIn: 'Taller solo sleepers who want full width with king-length legroom',
  },
  {
    name: 'Three Quarter',
    inches: '48" × 75"',
    usedIn: 'Antique bed frames and small guest rooms — between a twin and a full',
  },
  {
    name: 'Olympic Queen',
    inches: '66" × 80"',
    usedIn: 'Couples who want 6 extra inches of width without king bedding',
  },
];

export type FaqItem = {
  q: string;
  /**
   * Answer as plain text — used for both rendered HTML (with the
   * optional `link` becoming an `<a>`) and the FAQPage JSON-LD
   * acceptedAnswer (HTML-escaped). Keep concise (40-80 words) so
   * Google's rich snippet doesn't truncate.
   */
  a: string;
  /** Optional inline link inserted at the END of the answer. */
  link?: { href: string; label: string };
};

/**
 * The 14 questions are picked to land every Semrush-flagged keyword
 * variant for /pages/mattress-sizes in semantically natural form. Each
 * question maps to at least one flagged keyword (annotated in comments
 * below). Answers stay factual; no marketing voice.
 */
export const MATTRESS_SIZES_FAQ: FaqItem[] = [
  // → "60x80 bed size" / "size of queen bed" / "queen mattress dimensions"
  {
    q: 'What size is a 60×80 bed?',
    a: 'A 60" × 80" mattress is a Queen — the most popular size in the US. In feet that\'s 5 ft × 6 ft 8 in, or 152 × 203 cm. It fits most couples and works in a bedroom as small as 10 × 10 ft.',
    link: { href: '/collections/queen-size-mattresses', label: 'Shop Queen mattresses' },
  },
  // → "bed dimensions feet" / "king mattress size" / "king size mattress dimensions"
  {
    q: 'What are king mattress dimensions in feet?',
    a: 'A standard King mattress measures 6 ft 4 in × 6 ft 8 in (76" × 80" / 193 × 203 cm). California King is narrower but longer: 6 ft × 7 ft (72" × 84"). Both need a bedroom of at least 12 × 12 ft to walk around comfortably.',
    link: { href: '/collections/king-size-mattresses', label: 'Shop King mattresses' },
  },
  // → "king vs california king" / "king size measurement mattress"
  {
    q: 'King vs California King — what\'s the difference?',
    a: 'King is wider (76") but shorter (80"). California King is narrower (72") but longer (84"). Pick King if you want shoulder-room for two sleepers; pick Cal King if either sleeper is over 6 ft tall or your bedroom is long-and-narrow.',
    link: { href: '/blogs/mattress-buying-guide/king-vs-california-king', label: 'Read the full King vs Cal King guide' },
  },
  // → "size twin bed dimensions" / "twin bed size" / "twin mattress dimensions"
  {
    q: 'What size is a twin bed?',
    a: 'A standard Twin mattress is 38" × 75" — about 3 ft 2 in × 6 ft 3 in (96.5 × 190.5 cm). It\'s the smallest standard mattress size and the right choice for kids, single adults in studio apartments, and guest rooms.',
    link: { href: '/collections/twin-size-mattresses', label: 'Shop Twin mattresses' },
  },
  // → "twin vs twin xl"
  {
    q: 'Twin vs Twin XL — what\'s the difference?',
    a: 'Twin XL is the same width as Twin (38") but 5" longer — 38" × 80" instead of 38" × 75". Pick Twin XL if the sleeper is over 5\'6" or if you\'re furnishing a college dorm (most dorms spec Twin XL frames).',
    link: { href: '/collections/twin-xl-mattress-sale', label: 'Shop Twin XL mattresses' },
  },
  // → "full size mattress dimensions" / "size a full bed" / "bed full size"
  {
    q: 'What are full size mattress dimensions?',
    a: 'A Full (also called Double) mattress is 54" × 75" — 4 ft 6 in × 6 ft 3 in (137 × 190.5 cm). It\'s 16" wider than a Twin but the same length, so it gives solo sleepers more elbow room without needing a much bigger bedroom.',
    link: { href: '/collections/full-size-mattresses', label: 'Shop Full mattresses' },
  },
  // → "bed size chart" / "mattress size chart" / "bed sizes chart"
  {
    q: 'Is there a mattress size chart in feet?',
    a: 'Yes — the reference table above lists every standard mattress size in inches, feet, and centimeters. Twin is 3 ft 2 in × 6 ft 3 in; Queen is 5 ft × 6 ft 8 in; King is 6 ft 4 in × 6 ft 8 in; California King is 6 ft × 7 ft.',
  },
  // → "how big is a queen size bed" / "queen size bed"
  {
    q: 'How big is a Queen size bed in feet?',
    a: 'A Queen is 5 ft × 6 ft 8 in (60" × 80" or 152 × 203 cm). It\'s 6" wider than a Full and 5" longer, which is why it\'s the most-bought US mattress — enough room for two without dominating the bedroom.',
  },
  // → "what size is best for couples" / "queen mattress vs king mattress"
  {
    q: 'What size mattress is best for couples?',
    a: 'Queen (60" × 80") is the most-popular couples size — fits most US bedrooms and most bedding budgets. Upgrade to King (76" × 80") if either sleeper tosses, you co-sleep with kids/pets, or your room is at least 12 × 12 ft.',
  },
  // → "smallest bedroom for queen" / "room size for queen mattress"
  {
    q: 'What\'s the smallest bedroom that fits a Queen?',
    a: 'A 10 × 10 ft room is the working minimum for a Queen — the bed itself takes 5 × 6.7 ft and you need ~24" walk-around space on at least three sides. If you can\'t hit 10 × 10, drop down to a Full (54" × 75") to keep the room functional.',
  },
  // → "split king" / "adjustable bed sizes"
  {
    q: 'What is a Split King and who needs one?',
    a: 'A Split King is two Twin XL mattresses (38" × 80" each) side-by-side, totaling the same footprint as a regular King (76" × 80"). Each half can be raised or reclined independently on an adjustable base, so couples with different sleep positions or firmness preferences each get their own profile.',
    link: { href: '/collections/split-king-mattresses', label: 'Shop Split King mattresses' },
  },
  // → "what mattress sizes fit in a truck bed" / "moving a mattress"
  {
    q: 'Do you deliver every size — or do I move it myself?',
    a: 'Free white-glove delivery is included across Los Angeles County on every size we stock, with same-day setup available on most in-stock orders. We bring the bed in, set it on your frame, and haul the old one away. No tying it to your roof.',
    link: { href: '/pages/mattress-store-locations', label: 'Find your nearest LA showroom' },
  },
  // → general "which size should I buy"
  {
    q: 'I\'m not sure which size fits my room — what should I do?',
    a: 'Take the 2-minute sleep quiz — it asks about sleeper count, room size, and how you sleep, then recommends a specific size and mattress feel. Or call any LA showroom and we\'ll walk you through it; we can also measure your room with you over video.',
    link: { href: '/sleep-quiz', label: 'Take the sleep quiz' },
  },
  // → "largest mattress" / "biggest bed size"
  {
    q: 'What\'s the largest standard mattress size?',
    a: 'For mainstream bedding-compatible sizes, California King is the longest (84") and King is the widest (76"). Beyond standard, you can custom-order a Wyoming King (84" × 84") or Alaskan King (108" × 108") — call us if you need either; they aren\'t stocked on the floor.',
  },
];

/**
 * Related guides — curated cross-links from /pages/mattress-sizes to the
 * merchant blog. The 20-article refresh batch (sessions 20260530–31) added
 * keyword-rich content to every size/comparison article; the hub page was
 * pointing into them via FAQ links only once. This section closes the loop
 * so link equity flows both ways and crawlers can discover the full cluster
 * from the hub. Articles are picked by primary keyword angle — one canonical
 * per angle to avoid internal-link cannibalization.
 */
export type RelatedGuide = {
  /** Display title — short enough to fit one line on mobile. */
  title: string;
  /** Article path under /blogs/mattress-buying-guide/. */
  href: string;
};

export type RelatedGuideGroup = {
  heading: string;
  guides: RelatedGuide[];
};

export const MATTRESS_SIZES_RELATED_GUIDES: RelatedGuideGroup[] = [
  {
    heading: 'By size',
    guides: [
      { title: 'Twin mattress dimensions', href: '/blogs/mattress-buying-guide/what-is-the-size-of-a-twin-mattress' },
      { title: 'Full mattress dimensions', href: '/blogs/mattress-buying-guide/what-is-the-size-of-a-full-mattress' },
      { title: 'How big is a double bed?', href: '/blogs/mattress-buying-guide/how-bigs-a-double-bed' },
      { title: 'Queen mattress dimensions', href: '/blogs/mattress-buying-guide/what-is-the-size-of-a-queen-mattress' },
      { title: 'Queen size guide — inches, feet, cm', href: '/blogs/mattress-buying-guide/queen-mattress-size-guide-inches-feet-how-to-pick-the-perfect-fit' },
      { title: 'King mattress dimensions', href: '/blogs/mattress-buying-guide/what-is-the-size-of-a-king-mattress' },
      { title: 'King size guide — types & how to choose', href: '/blogs/mattress-buying-guide/king-size-mattress-guide-what-are-the-dimensions-and-benefits' },
      { title: 'Standard size of a Full bed', href: '/blogs/mattress-buying-guide/what-is-the-standard-size-of-a-full-bed' },
    ],
  },
  {
    heading: 'Size comparisons',
    guides: [
      { title: 'Queen vs King', href: '/blogs/mattress-buying-guide/queen-mattress-vs-king-mattress' },
      { title: 'King vs California King', href: '/blogs/mattress-buying-guide/king-vs-california-king' },
      { title: 'California King vs King', href: '/blogs/mattress-buying-guide/california-king-vs-king-what-s-the-real-difference' },
      { title: 'Full vs Queen', href: '/blogs/mattress-buying-guide/full-vs-queen-mattress' },
      { title: 'Queen vs California Queen', href: '/blogs/mattress-buying-guide/queen-vs-california-queen-which-size-fits-your-needs' },
      { title: 'Twin, Full, Queen & King — full chart', href: '/blogs/mattress-buying-guide/mattress-size-comparison-chart-twin-full-queen-king-explained' },
    ],
  },
  {
    heading: 'Practical & room layout',
    guides: [
      { title: 'Complete mattress size guide', href: '/blogs/mattress-buying-guide/how-to-choose-the-best-mattress-size' },
      { title: 'How to choose the right size for your lifestyle', href: '/blogs/mattress-buying-guide/how-to-choose-the-right-mattress-size-for-your-lifestyle' },
      { title: 'Full bed room-layout tips', href: '/blogs/mattress-buying-guide/full-size-mattress-measurements-room-layout-tips' },
      { title: 'How much space a Full mattress gives you', href: '/blogs/mattress-buying-guide/how-much-space-does-a-full-size-mattress-really-give-you' },
      { title: 'Will a Queen frame fit a Full mattress?', href: '/blogs/mattress-buying-guide/will-a-queen-bed-frame-fit-a-full-size-mattress' },
    ],
  },
];
