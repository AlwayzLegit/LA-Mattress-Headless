/**
 * Coded /pages/* routes that have NO Shopify CMS page behind them — the
 * route component renders a hand-built template instead. Legacy URLs
 * (linked from old blog bodies) thus resolve 200 with real content
 * rather than 404 (SEMrush 20260518 broken-internal-links).
 *
 * Single source of truth shared by app/pages/[handle]/page.tsx
 * (dispatch + generateMetadata + generateStaticParams), the segment
 * layout (JSON-LD), and app/sitemap.ts.
 */
import { faqJsonLd, FAQ_PAGE_ITEMS } from './faq';

const SITE = 'https://www.mattressstoreslosangeles.com';

export const CODED_PAGE_HANDLES = [
  'faq',
  'low-price-guarantee',
  'reviews',
  'data-sharing-opt-out',
] as const;
export type CodedPageHandle = (typeof CODED_PAGE_HANDLES)[number];

export function isCodedPage(handle: string): handle is CodedPageHandle {
  return (CODED_PAGE_HANDLES as readonly string[]).includes(handle);
}

const META: Record<CodedPageHandle, { title: string; description: string; h1: string }> = {
  faq: {
    title: 'Mattress FAQ — Delivery, Financing & Returns | LA Mattress Store',
    description:
      'Answers on free white-glove LA delivery, 0% APR financing, the 120-night comfort exchange, our price match, showrooms, and choosing the right mattress.',
    h1: 'Frequently asked questions',
  },
  'low-price-guarantee': {
    title: 'Low Price Guarantee | LA Mattress Store',
    description:
      'Our price-match promise — and why LA Mattress prices stay competitive: authorized dealer, five LA showrooms, salaried (never commission) staff, and a 120-night comfort exchange.',
    h1: 'Our low price guarantee',
  },
  reviews: {
    title: 'Customer Reviews | LA Mattress Store',
    description:
      'Read verified customer reviews of LA Mattress Store. Real shoppers, real beds, real opinions — collected via Judge.me from buyers across Los Angeles.',
    h1: 'Customer reviews',
  },
  'data-sharing-opt-out': {
    title: 'Do Not Sell or Share My Personal Information | LA Mattress Store',
    description:
      'California residents: submit a request to opt out of the sale or sharing of your personal information, or to exercise other rights under the CCPA / CPRA.',
    h1: 'Do not sell or share my personal information',
  },
};

export function codedPageMeta(handle: CodedPageHandle) {
  return META[handle];
}

export type CodedPageLd = { key: string; data: unknown };

export function getCodedPageJsonLd(handle: CodedPageHandle): CodedPageLd[] {
  const url = `${SITE}/pages/${handle}`;
  const name = META[handle].h1;
  const out: CodedPageLd[] = [
    {
      key: 'ld-page',
      data: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name,
        url,
        isPartOf: { '@type': 'WebSite', url: SITE },
        inLanguage: 'en-US',
      },
    },
    {
      key: 'ld-breadcrumb-page',
      data: {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name, item: url },
        ],
      },
    },
  ];
  if (handle === 'faq') {
    out.push({ key: 'ld-faq-page', data: faqJsonLd(FAQ_PAGE_ITEMS) });
  }
  return out;
}
