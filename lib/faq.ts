/**
 * Homepage FAQ items — sourced from the storefront's FAQ section so we can
 * also emit FAQPage JSON-LD on the server for Google featured-snippet
 * eligibility. Keep questions/answers free of HTML markup so they
 * serialize cleanly into the structured-data block.
 *
 * Static constants below are the in-code FALLBACK. The live source is
 * `getFaqItems()` from lib/shopify/queries/faq.ts (Shopify `faq_item`
 * metaobjects). Merchant edits in Shopify Admin → Content →
 * Metaobjects → FAQ item propagate within one ISR cycle. The
 * `resolveHomepageFaq()` / `resolveFaqPageSections()` helpers below
 * merge live + fallback so callers don't have to repeat the
 * empty-array fallback every time.
 */
import type { LiveFaqItem } from './shopify/queries/faq';

export type FaqItem = { q: string; a: string };

// Single source for the published price-match commitment — used by the
// homepage FAQ, the /pages/faq FAQ, their FAQPage JSON-LD, and the
// /pages/low-price-guarantee callout, so the wording can never drift.
export const PRICE_MATCH_TEXT =
  'Yes. If you find the same mattress for less at any authorized retailer within 30 days, we’ll refund the difference plus 10%.';

export const HOMEPAGE_FAQ: FaqItem[] = [
  {
    q: 'Do you price match?',
    a: PRICE_MATCH_TEXT,
  },
  {
    q: 'How fast is delivery?',
    a: 'Same-day anywhere in LA if ordered before 4pm. Otherwise next-day. Free white-glove delivery, setup, and old mattress haul-away on orders over $499.',
  },
  {
    q: 'What if I don’t like it?',
    a: '120-night comfort exchange. Sleep on it for at least 30 nights, then if it’s not right, exchange for any other mattress, and we credit the full original price.',
  },
  {
    q: 'Is financing actually 0%?',
    a: 'Yes. We offer 0% APR financing through Synchrony and Acima on approved credit. Terms vary by purchase amount and partner. Apply at checkout or in any showroom.',
  },
  {
    q: 'Can I see them in person first?',
    a: 'Absolutely, that’s the whole point. Every mattress is on the floor at one of our 5 LA showrooms. No appointment needed.',
  },
  {
    q: 'Do you remove my old mattress?',
    a: 'Free haul-away on every white-glove delivery. We recycle responsibly so your old mattress doesn’t end up in a landfill.',
  },
  // Phase 292 (cowork LOW#14): expanded 6 → 10 questions. Google's
  // FAQ rich result surfaces up to ~10 entries; the extra four target
  // high-intent search queries (cooling, sizes, bad-credit financing,
  // brands) that weren't covered above.
  {
    q: 'Do you carry cooling mattresses?',
    a: 'Yes: gel memory foam, phase-change covers, and breathable hybrids from Tempur-Pedic, Diamond, Helix and more. Tell us how hot you sleep in the 2-minute sleep quiz and we’ll narrow it down.',
  },
  {
    q: 'What mattress sizes do you stock?',
    a: 'Every standard size (Twin, Twin XL, Full, Queen, King, California King, and Split King) on the floor at all 5 LA showrooms, in most brands and comfort levels.',
  },
  {
    q: 'Can I finance with bad credit?',
    a: 'Yes. Alongside 0% APR Synchrony financing on approved credit, we offer Acima lease-to-own with no credit needed. Most customers are approved in minutes in-store or at checkout.',
  },
  {
    q: 'Which mattress brands do you sell?',
    a: 'Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Helix, Englander, Chattam & Wells, Eastman House, Southerland and more, plus our own value-priced private label.',
  },
];

export function faqJsonLd(items: FaqItem[] = HOMEPAGE_FAQ) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
}

/**
 * Curated, grouped FAQ for the dedicated /pages/faq page. Answers reuse
 * the already-published, vetted HOMEPAGE_FAQ copy verbatim where they
 * overlap (incl. the live price-match commitment) so nothing diverges
 * from what's already stated site-wide. FAQ_PAGE_ITEMS is the flat list
 * for the page's FAQPage JSON-LD.
 */
export type FaqSection = { title: string; items: FaqItem[] };

export const FAQ_PAGE_SECTIONS: FaqSection[] = [
  {
    title: 'Pricing & price match',
    items: [
      {
        q: 'Do you price match?',
        a: PRICE_MATCH_TEXT,
      },
      {
        q: 'Is financing actually 0%?',
        a: 'Yes. We offer 0% APR financing through Synchrony and Acima on approved credit. Terms vary by purchase amount and partner. Apply at checkout or in any showroom.',
      },
      {
        q: 'Can I finance with bad credit?',
        a: 'Yes. Alongside 0% APR Synchrony financing on approved credit, we offer Acima lease-to-own with no credit needed. Most customers are approved in minutes in-store or at checkout.',
      },
    ],
  },
  {
    title: 'Delivery & setup',
    items: [
      {
        q: 'How fast is delivery?',
        a: 'Same-day anywhere in LA if ordered before 4pm. Otherwise next-day. Free white-glove delivery, setup, and old mattress haul-away on orders over $499.',
      },
      {
        q: 'Do you remove my old mattress?',
        a: 'Free haul-away on every white-glove delivery. We recycle responsibly so your old mattress doesn’t end up in a landfill.',
      },
    ],
  },
  {
    title: 'Returns & the 120-night guarantee',
    items: [
      {
        q: 'What if I don’t like it?',
        a: '120-night comfort exchange. Sleep on it for at least 30 nights, then if it’s not right, exchange for any other mattress, and we credit the full original price.',
      },
    ],
  },
  {
    title: 'Visiting our showrooms',
    items: [
      {
        q: 'Can I see them in person first?',
        a: 'Absolutely, that’s the whole point. Every mattress is on the floor at one of our 5 LA showrooms. No appointment needed.',
      },
      {
        q: 'Will I get a hard sell?',
        a: 'No. Our sleep consultants are trained on every brand we carry: real advice, not a hard sell. Lie down as long as you want and leave when you want. Five LA showrooms: Koreatown, West LA, La Brea / Hancock Park, Studio City, and Glendale.',
      },
    ],
  },
  {
    title: 'Choosing a mattress',
    items: [
      {
        q: 'How do I pick the right mattress?',
        a: 'Try every mattress in-store, or take our free 2-minute sleep quiz for a category recommendation based on how you sleep, then narrow it down on the showroom floor.',
      },
      {
        q: 'Do you carry cooling mattresses?',
        a: 'Yes: gel memory foam, phase-change covers, and breathable hybrids from Tempur-Pedic, Diamond, Helix and more. Tell us how hot you sleep in the 2-minute sleep quiz and we’ll narrow it down.',
      },
      {
        q: 'What mattress sizes do you stock?',
        a: 'Every standard size (Twin, Twin XL, Full, Queen, King, California King, and Split King) on the floor at all 5 LA showrooms, in most brands and comfort levels.',
      },
      {
        q: 'Which mattress brands do you sell?',
        a: 'Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Helix, Englander, Chattam & Wells, Eastman House, Southerland and more, plus our own value-priced private label.',
      },
    ],
  },
];

export const FAQ_PAGE_ITEMS: FaqItem[] = FAQ_PAGE_SECTIONS.flatMap((s) => s.items);

/* ────────────────────────────────────────────────────────────────────
   Live FAQ resolvers — merge a `getFaqItems()` result from Shopify
   metaobjects into the same shape callers already consume. Falls back
   to the static constants above when the live array is empty.

   Callers:
     - homepage FAQ section + JSON-LD → resolveHomepageFaq(liveItems)
     - /pages/faq sections + JSON-LD  → resolveFaqPageSections(liveItems)

   Both helpers are pure — caller awaits getFaqItems() once and passes
   the result in. Keeps this module server/client-friendly (no async,
   no `server-only`).
   ──────────────────────────────────────────────────────────────────── */

const MAX_HOMEPAGE_ITEMS = 10;

export function resolveHomepageFaq(live: LiveFaqItem[]): FaqItem[] {
  const subset = live
    .filter((it) => it.showOnHomepage)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, MAX_HOMEPAGE_ITEMS)
    .map((it) => ({ q: it.question, a: it.answer }));
  return subset.length > 0 ? subset : HOMEPAGE_FAQ;
}

export function resolveFaqPageSections(live: LiveFaqItem[]): FaqSection[] {
  if (live.length === 0) return FAQ_PAGE_SECTIONS;
  // Group by section, preserving the section order defined by the
  // smallest display_order in each bucket. Items within a section are
  // sorted by display_order.
  const buckets = new Map<string, LiveFaqItem[]>();
  for (const item of live) {
    const list = buckets.get(item.section);
    if (list) list.push(item);
    else buckets.set(item.section, [item]);
  }
  return [...buckets.entries()]
    .map(([title, items]) => ({
      title,
      items: items
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((it) => ({ q: it.question, a: it.answer })),
      order: Math.min(...items.map((it) => it.displayOrder)),
    }))
    .sort((a, b) => a.order - b.order)
    .map(({ title, items }): FaqSection => ({ title, items }));
}
