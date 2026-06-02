/**
 * Reference data for the dedicated `/pages/mattress-types` template
 * (app/_components/sections/mattress-types-page.tsx).
 *
 * Why this exists: the merchant CMS body for `/pages/mattress-types`
 * is strong editorial copy but almost entirely text — the live page
 * carried just 2 images, a poor text-to-image ratio that reads as a
 * wall of prose next to competitor pages (Saatva, Helix, Mattress
 * Firm), which all lead with a layered construction cutaway diagram
 * and an at-a-glance feel/rating visual per type.
 *
 * This data drives those graphics in code (inline SVG — no external
 * image assets, crisp at any DPI, zero added page weight beyond
 * markup): a per-type construction cross-section, a six-axis feel
 * profile rendered as rating bars, and a comparison matrix. The
 * merchant body stays the editorial source of truth and renders
 * above; these visual blocks render below it.
 *
 * LAYERS — top-to-bottom cross-section of a representative build for
 * each type. `kind` drives how the SVG band is drawn (foam/latex/
 * cover = solid band, coil = band with spring glyphs). `units` is the
 * band's relative thickness (the SVG normalizes the stack to fill the
 * mattress height).
 *
 * RATINGS — 1–5 on the six axes shoppers actually compare. Sourced
 * from the same feel guidance the showroom team gives and the PDP /
 * collection deep-content copy already uses, so the visual and the
 * prose agree.
 */

export type LayerKind = 'cover' | 'foam' | 'memory' | 'latex' | 'coil' | 'base';

export type ConstructionLayer = {
  label: string;
  kind: LayerKind;
  /** Relative thickness; the SVG normalizes the stack to the slab height. */
  units: number;
  /** Fill for the band (foam/latex/cover/base). Coil bands use a tint + glyphs. */
  fill: string;
};

export type FeelRatings = {
  pressureRelief: number;
  cooling: number;
  support: number;
  motionIsolation: number;
  responsiveness: number;
  durability: number;
};

export type MattressType = {
  /** Display name ("Memory foam"). */
  name: string;
  /** Stable id for keys / anchors. */
  slug: string;
  /** Collection PLP this type links to. */
  collectionHref: string;
  /** One-line "what it is". */
  tagline: string;
  /** Top-to-bottom construction for the cutaway diagram. */
  layers: ConstructionLayer[];
  /** Six-axis feel profile (1–5). */
  ratings: FeelRatings;
  /** Who it fits — short tags rendered as pills. */
  bestFor: string[];
  /** Relative price tier. */
  priceTier: '$' | '$$' | '$$$';
  /** The honest trade-off, one line. */
  watchOut: string;
};

// Layer fills — a restrained palette that reads as "mattress layers"
// while staying in the navy/blue brand family. Cover = warm sand,
// comfort foams = blue tints (lighter = softer/closer to the surface),
// coils = pale steel, base = slate.
const FILL = {
  cover: '#EFE7D6',
  memory: '#BFD0F0',
  foamSoft: '#D7E2F6',
  foam: '#C7D6F2',
  latexTop: '#CFE6D8',
  latex: '#BBDDC6',
  coilTint: '#EEF1F6',
  base: '#9FB0C9',
} as const;

export const MATTRESS_TYPES: MattressType[] = [
  {
    name: 'Memory foam',
    slug: 'memory-foam',
    collectionHref: '/collections/memory-foam-mattresses',
    tagline: 'Body-hugging contour and the best motion isolation we sell.',
    layers: [
      { label: 'Knit cover', kind: 'cover', units: 0.6, fill: FILL.cover },
      { label: 'Memory foam comfort layer', kind: 'memory', units: 2.4, fill: FILL.memory },
      { label: 'Transition foam', kind: 'foam', units: 1.6, fill: FILL.foamSoft },
      { label: 'High-density base foam', kind: 'base', units: 3.2, fill: FILL.base },
    ],
    ratings: { pressureRelief: 5, cooling: 2, support: 4, motionIsolation: 5, responsiveness: 2, durability: 3 },
    bestFor: ['Side sleepers', 'Pressure-point pain', 'Restless partners', 'Light–medium weight'],
    priceTier: '$$',
    watchOut: 'Sleeps warmer and feels less bouncy than coils or latex.',
  },
  {
    name: 'Hybrid',
    slug: 'hybrid',
    collectionHref: '/collections/hybrid-mattresses',
    tagline: 'Pocketed coils for support and airflow, foam on top for contour.',
    layers: [
      { label: 'Quilted cover', kind: 'cover', units: 0.6, fill: FILL.cover },
      { label: 'Foam / latex comfort layer', kind: 'foam', units: 2.0, fill: FILL.foam },
      { label: 'Pocketed coil support unit', kind: 'coil', units: 3.4, fill: FILL.coilTint },
      { label: 'High-density base foam', kind: 'base', units: 1.4, fill: FILL.base },
    ],
    ratings: { pressureRelief: 4, cooling: 4, support: 5, motionIsolation: 4, responsiveness: 4, durability: 4 },
    bestFor: ['Most sleepers', 'Combination sleepers', 'Couples', 'Hot sleepers', 'Heavier bodies'],
    priceTier: '$$$',
    watchOut: 'Heavier to move and usually costs more than all-foam.',
  },
  {
    name: 'Innerspring',
    slug: 'innerspring',
    collectionHref: '/collections/innerspring-mattresses',
    tagline: 'A traditional coil core — bouncy, breathable, supportive.',
    layers: [
      { label: 'Pillow-top / comfort layer', kind: 'foam', units: 1.5, fill: FILL.foamSoft },
      { label: 'Steel coil core', kind: 'coil', units: 4.5, fill: FILL.coilTint },
      { label: 'Support base', kind: 'base', units: 1.0, fill: FILL.base },
    ],
    ratings: { pressureRelief: 2, cooling: 5, support: 4, motionIsolation: 2, responsiveness: 5, durability: 3 },
    bestFor: ['Back & stomach sleepers', 'Hot sleepers', 'Firm-feel fans', 'Budget'],
    priceTier: '$',
    watchOut: 'Less motion isolation and a thinner comfort layer than foam.',
  },
  {
    name: 'Latex',
    slug: 'latex',
    collectionHref: '/collections/latex-mattresses',
    tagline: 'Buoyant, breathable, and the longest-lasting material we carry.',
    layers: [
      { label: 'Talalay latex comfort layer', kind: 'latex', units: 2.2, fill: FILL.latexTop },
      { label: 'Dunlop latex transition', kind: 'latex', units: 2.0, fill: FILL.latex },
      { label: 'High-density support base', kind: 'base', units: 2.4, fill: FILL.base },
    ],
    ratings: { pressureRelief: 4, cooling: 4, support: 4, motionIsolation: 3, responsiveness: 5, durability: 5 },
    bestFor: ['Hot sleepers', 'Eco-conscious', 'Joint pain', 'Longevity'],
    priceTier: '$$$',
    watchOut: 'Higher upfront cost and a springy feel some foam fans dislike.',
  },
];

/** The six rating axes in display order, with a human label. */
export const FEEL_AXES: Array<{ key: keyof FeelRatings; label: string }> = [
  { key: 'pressureRelief', label: 'Pressure relief' },
  { key: 'support', label: 'Support' },
  { key: 'cooling', label: 'Cooling' },
  { key: 'motionIsolation', label: 'Motion isolation' },
  { key: 'responsiveness', label: 'Responsiveness' },
  { key: 'durability', label: 'Durability' },
];
