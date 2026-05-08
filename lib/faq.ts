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
    a: 'Same-day to most LA zip codes if ordered before 12pm. Otherwise next-day. Free white-glove setup and old mattress haul-away on orders over $799.',
  },
  {
    q: 'What if I don’t like it?',
    a: '120-night comfort exchange. Sleep on it for at least 30 nights, then if it’s not right, exchange for any other mattress — we credit the full original price.',
  },
  {
    q: 'Is financing actually 0%?',
    a: 'Yes. 0% APR for up to 60 months on approved credit, with no prepayment penalty and no origination fees.',
  },
  {
    q: 'Can I see them in person first?',
    a: 'Absolutely — that’s the whole point. Every mattress is on the floor at one of our 5 LA showrooms. No appointment needed.',
  },
  {
    q: 'Do you remove my old mattress?',
    a: 'Free haul-away on every white-glove delivery. We recycle responsibly through a local LA partner.',
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
