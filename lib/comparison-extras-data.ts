/**
 * Code-controlled visual blocks for the ComparisonPage template,
 * rendered between the merchant body and the CTA on the "X vs Y" pages.
 *
 * Why: the comparison pages already carry a strong VS hero + the
 * merchant's side-by-side table, but the decision guidance ("when X is
 * the right pick") and the feel differences were buried in prose. This
 * surfaces them as the two visuals competitor comparison pages lead
 * with — a "Choose X if…" decision-card pair and (for brand-vs-brand) a
 * feel-rating comparison.
 *
 * IMPORTANT — accuracy: every point here is lifted from the merchant's
 * OWN published page copy (the "When X is the right pick / better
 * choice" sections and the side-by-side table). Nothing is invented,
 * and the competitor's card is kept genuinely useful (it lists when the
 * competitor really is the better choice), so the block reads as honest
 * guidance, not disparagement. Feel ratings map the merchant table's
 * qualitative cells ("Excellent" → 5, "Good" → 4, "Decent" → 3,
 * "Low" → 2) to dots.
 *
 * `decide` and `feel.axes` are ordered [left, right] to match the hero
 * plates in lib/comparison-pages.ts COMPARISON_PAGES[handle].sides.
 */

import type { ComparisonPageHandle } from '@/lib/comparison-pages';

export type DecideCard = {
  /** Brand/retailer name — matches the hero plate. */
  name: string;
  /** Short "who it's for" framing under the card title. */
  whenLabel: string;
  /** 3–4 bullet reasons, paraphrased from the merchant body. */
  points: string[];
};

export type FeelAxis = {
  label: string;
  /** 1–5 for the left side. */
  left: number;
  /** 1–5 for the right side. */
  right: number;
};

export type ComparisonExtrasData = {
  decideHeading: string;
  /** [left, right] — same order as COMPARISON_PAGES[handle].sides. */
  decide: [DecideCard, DecideCard];
  /** Optional feel-rating comparison (brand-vs-brand only). */
  feel?: { heading: string; note: string; axes: FeelAxis[] };
};

export const COMPARISON_EXTRAS: Partial<Record<ComparisonPageHandle, ComparisonExtrasData>> = {
  'purple-mattress-vs-tempur-pedic': {
    decideHeading: 'Which one should you choose?',
    decide: [
      {
        name: 'Purple',
        whenLabel: 'Choose Purple if you’re…',
        points: [
          'A back or stomach sleeper who wants more pushback',
          'A hot sleeper who doesn’t want to pay a Breeze premium for cooling',
          'A combination sleeper who dislikes the “stuck” feel of memory foam',
          'After a firmer, bouncier feel that pushes back when you press in',
        ],
      },
      {
        name: 'Tempur-Pedic',
        whenLabel: 'Choose Tempur-Pedic if you’re…',
        points: [
          'A side sleeper, especially with hip or shoulder pain',
          'Sharing the bed with a partner who moves a lot (best-in-class motion isolation)',
          'After a slow-response, body-hugging “sinking in” feel',
          'Open to a Breeze cooling model if you sleep hot',
        ],
      },
    ],
    feel: {
      heading: 'How they feel, rated',
      note: 'Based on the side-by-side above — more dots means more of that quality.',
      axes: [
        { label: 'Pressure relief', left: 4, right: 5 },
        { label: 'Motion isolation', left: 3, right: 5 },
        { label: 'Cooling', left: 5, right: 2 },
        { label: 'Responsiveness / bounce', left: 5, right: 2 },
        { label: 'Body-hugging contour', left: 2, right: 5 },
      ],
    },
  },
  'mattress-firm-vs-la-mattress-store': {
    decideHeading: 'Which store should you choose?',
    decide: [
      {
        name: 'LA Mattress Store',
        whenLabel: 'Choose LA Mattress if you…',
        points: [
          'Live in LA and want same-day white-glove delivery with included haul-away',
          'Prefer a salaried consultant who isn’t paid to push the higher-margin bed',
          'Want a longer no-restocking-fee exchange (120 nights, no redelivery fee)',
          'Are considering Chattam & Wells, Spring Air, Diamond, or Englander',
        ],
      },
      {
        name: 'Mattress Firm',
        whenLabel: 'Choose Mattress Firm if you…',
        points: [
          'Are shopping outside the LA service area and need a national chain nearby',
          'Want a Mattress Firm-exclusive house brand (Sleepy’s, Therapedic)',
          'Are relocating and want store presence in your destination market',
          'Find the same SKU cheaper there — our 10%-beat price guarantee still applies',
        ],
      },
    ],
  },
};
