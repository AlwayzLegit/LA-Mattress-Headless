import { shopifyFetch } from '../client';
import type { ProductSummary } from '../types';
import { IMAGE_FRAGMENT, MONEY_FRAGMENT, PRODUCT_SUMMARY_FRAGMENT } from './fragments';
import { parseReviewsMetafields } from './product';

/**
 * Phase 255: fetch every quiz product pick in a single Storefront round-trip.
 *
 * The sleep quiz computes its recommendation client-side from the user's
 * answers, then renders a product hero card on the result screen. The
 * card needs full ProductSummary data (image, price, vendor, reviews
 * badge) for every possible pick — there are 8 picks total across the
 * (material × {premium, default}) grid in `quiz-data.ts`. Rather than
 * fetch on the client when the user lands on the result page (a 200-300ms
 * stall right when they want the answer), we pre-fetch all 8 server-side
 * inside the `/sleep-quiz` page render and pass the result down as a
 * record. ISR + Next's fetch cache keep that to one upstream call per
 * revalidation window.
 *
 * Implementation uses GraphQL aliases (`p0`, `p1`, …) so all 8 lookups
 * resolve in parallel inside Shopify and we get a single deterministic
 * payload back. Any handle that doesn't resolve (typo, archived product)
 * comes back as `null` and is omitted from the returned record — the UI
 * is expected to fall back to the category recommendation in that case.
 */
type RawSpecMetafield = { value: string } | null;
type RawReviewMetafield = { value: string; type: string } | null;

type RawSummary = Omit<ProductSummary, 'reviews' | 'specs'> & {
  firmnessMetafield?: RawSpecMetafield;
  heightMetafield?:   RawSpecMetafield;
  materialMetafield?: RawSpecMetafield;
  ratingMetafield?:        RawReviewMetafield;
  ratingCountMetafield?:   RawReviewMetafield;
  judgemeBadgeMetafield?:  RawReviewMetafield;
};

function liftSummary(n: RawSummary): ProductSummary {
  const {
    firmnessMetafield, heightMetafield, materialMetafield,
    ratingMetafield, ratingCountMetafield, judgemeBadgeMetafield,
    ...rest
  } = n;
  const heightStr = heightMetafield?.value;
  const heightNum = heightStr ? Number.parseFloat(heightStr) : NaN;
  return {
    ...rest,
    specs: {
      firmness: firmnessMetafield?.value || null,
      heightInches: Number.isFinite(heightNum) ? heightNum : null,
      materialType: materialMetafield?.value || null,
    },
    reviews: parseReviewsMetafields(ratingMetafield, ratingCountMetafield, judgemeBadgeMetafield),
  };
}

export async function getQuizPicks(handles: string[]): Promise<Record<string, ProductSummary>> {
  if (handles.length === 0) return {};

  const aliases = handles.map((_, i) => `p${i}`);
  const query = /* GraphQL */ `
    ${IMAGE_FRAGMENT}
    ${MONEY_FRAGMENT}
    ${PRODUCT_SUMMARY_FRAGMENT}
    query QuizPicks(${aliases.map((a) => `$${a}: String!`).join(', ')}) {
      ${aliases.map((a) => `${a}: productByHandle(handle: $${a}) { ...ProductSummaryFields }`).join('\n      ')}
    }
  `;
  const variables: Record<string, string> = {};
  handles.forEach((h, i) => { variables[aliases[i]] = h; });

  const data = await shopifyFetch<Record<string, RawSummary | null>, Record<string, string>>(
    query,
    variables,
    { tags: ['quiz-picks'] },
  );

  const out: Record<string, ProductSummary> = {};
  handles.forEach((h, i) => {
    const node = data[aliases[i]];
    if (node) out[h] = liftSummary(node);
  });
  return out;
}
