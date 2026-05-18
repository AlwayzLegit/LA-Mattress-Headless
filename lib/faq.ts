/**
 * Homepage FAQ items — sourced from the storefront's FAQ section so we can
 * also emit FAQPage JSON-LD on the server for Google featured-snippet
 * eligibility. Keep questions/answers free of HTML markup so they
 * serialize cleanly into the structured-data block.
 */
export type FaqItem = { q: string; a: string };

export const HOMEPAGE_FAQ: FaqItem[] = [
  {
    q: 'Do you price match?',
    a: 'Yes — if you find the same mattress for less at any authorized retailer within 30 days, we’ll refund the difference plus 10%.',
  },
  {
    q: 'How fast is delivery?',
    a: 'Same-day anywhere in LA if ordered before 4pm. Otherwise next-day. Free white-glove delivery, setup, and old mattress haul-away on orders over $499.',
  },
  {
    q: 'What if I don’t like it?',
    a: '120-night comfort exchange. Sleep on it for at least 30 nights, then if it’s not right, exchange for any other mattress — we credit the full original price.',
  },
  {
    q: 'Is financing actually 0%?',
    a: 'Yes. We offer 0% APR financing through Synchrony and Acima on approved credit — terms vary by purchase amount and partner. Apply at checkout or in any showroom.',
  },
  {
    q: 'Can I see them in person first?',
    a: 'Absolutely — that’s the whole point. Every mattress is on the floor at one of our 5 LA showrooms. No appointment needed.',
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
    a: 'Yes — gel memory foam, phase-change covers, and breathable hybrids from Tempur-Pedic, Diamond, Helix and more. Tell us how hot you sleep in the 2-minute sleep quiz and we’ll narrow it down.',
  },
  {
    q: 'What mattress sizes do you stock?',
    a: 'Every standard size — Twin, Twin XL, Full, Queen, King, California King, and Split King — on the floor at all 5 LA showrooms, in most brands and comfort levels.',
  },
  {
    q: 'Can I finance with bad credit?',
    a: 'Yes. Alongside 0% APR Synchrony financing on approved credit, we offer Acima lease-to-own with no credit needed — most customers are approved in minutes in-store or at checkout.',
  },
  {
    q: 'Which mattress brands do you sell?',
    a: 'Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Helix, Englander, Chattam & Wells, Eastman House, Southerland and more — plus our own value-priced private label.',
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
        a: 'Yes — if you find the same mattress for less at any authorized retailer within 30 days, we’ll refund the difference plus 10%.',
      },
      {
        q: 'Is financing actually 0%?',
        a: 'Yes. We offer 0% APR financing through Synchrony and Acima on approved credit — terms vary by purchase amount and partner. Apply at checkout or in any showroom.',
      },
      {
        q: 'Can I finance with bad credit?',
        a: 'Yes. Alongside 0% APR Synchrony financing on approved credit, we offer Acima lease-to-own with no credit needed — most customers are approved in minutes in-store or at checkout.',
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
        a: '120-night comfort exchange. Sleep on it for at least 30 nights, then if it’s not right, exchange for any other mattress — we credit the full original price.',
      },
    ],
  },
  {
    title: 'Visiting our showrooms',
    items: [
      {
        q: 'Can I see them in person first?',
        a: 'Absolutely — that’s the whole point. Every mattress is on the floor at one of our 5 LA showrooms. No appointment needed.',
      },
      {
        q: 'Will I get a hard sell?',
        a: 'No. Our consultants are salaried, never commission — lie down as long as you want and leave when you want. Five LA showrooms: Koreatown, West LA, La Brea / Hancock Park, Studio City, and Glendale.',
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
        a: 'Yes — gel memory foam, phase-change covers, and breathable hybrids from Tempur-Pedic, Diamond, Helix and more. Tell us how hot you sleep in the 2-minute sleep quiz and we’ll narrow it down.',
      },
      {
        q: 'What mattress sizes do you stock?',
        a: 'Every standard size — Twin, Twin XL, Full, Queen, King, California King, and Split King — on the floor at all 5 LA showrooms, in most brands and comfort levels.',
      },
      {
        q: 'Which mattress brands do you sell?',
        a: 'Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Helix, Englander, Chattam & Wells, Eastman House, Southerland and more — plus our own value-priced private label.',
      },
    ],
  },
];

export const FAQ_PAGE_ITEMS: FaqItem[] = FAQ_PAGE_SECTIONS.flatMap((s) => s.items);
