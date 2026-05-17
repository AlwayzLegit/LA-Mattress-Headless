import { cache } from 'react';
import { shopifyFetch } from '../client';
import type {
  Product, ProductReviews, ProductSpecs,
  ProductEditorial, ProductHighlight, ProductLayer, SleepPositionFit,
} from '../types';
import {
  IMAGE_FRAGMENT, MONEY_FRAGMENT, SEO_FRAGMENT,
  VARIANT_FRAGMENT, PRODUCT_FRAGMENT,
} from './fragments';

const GET_PRODUCT_BY_HANDLE = /* GraphQL */ `
  ${IMAGE_FRAGMENT}
  ${MONEY_FRAGMENT}
  ${SEO_FRAGMENT}
  ${VARIANT_FRAGMENT}
  ${PRODUCT_FRAGMENT}
  query GetProductByHandle($handle: String!) {
    product(handle: $handle) {
      ...ProductFields
    }
  }
`;

type RawMetafield = { value: string; type: string } | null;

type Raw = {
  product:
    | (Omit<Product, 'images' | 'variants' | 'reviews' | 'specs' | 'editorial'> & {
        images: { nodes: Product['images'] };
        variants: { nodes: Product['variants'] };
        ratingMetafield?: RawMetafield;
        ratingCountMetafield?: RawMetafield;
        judgemeBadgeMetafield?: RawMetafield;
        firmnessMetafield?: RawMetafield;
        heightMetafield?: RawMetafield;
        materialMetafield?: RawMetafield;
        warrantyMetafield?: RawMetafield;
        trialMetafield?: RawMetafield;
        taglineMetafield?: RawMetafield;
        ledeMetafield?: RawMetafield;
        bestForMetafield?: RawMetafield;
        notIdealForMetafield?: RawMetafield;
        highlightsMetafield?: RawMetafield;
        firmnessScoreMetafield?: RawMetafield;
        positionFitMetafield?: RawMetafield;
        layersMetafield?: RawMetafield;
      })
    | null;
};

/**
 * Parse Judge.me review aggregates into a ProductReviews object. Tries
 * two sources in priority order:
 *
 *   1. Structured metafields `reviews.rating` + `reviews.rating_count`
 *      (only present on Judge.me's paid plans that expose the
 *      Storefront-API metafield toggle).
 *   2. HTML-blob metafield `judgeme.badge` with `data-average-rating`
 *      + `data-number-of-reviews` attributes (available on all Judge.me
 *      plans by default — this is what the Liquid theme widget reads).
 *
 * Returns null when:
 *  - the merchant hasn't installed Judge.me yet
 *  - the product has no reviews (count is 0)
 *  - none of the metafields have storefront access enabled
 *
 * Phase 241: added the `judgemeBadgeMetafield` fallback so the headless
 * gets aggregate stars for every product immediately, without waiting
 * on a Judge.me plan upgrade.
 */
export function parseReviewsMetafields(
  ratingMetafield?: RawMetafield,
  ratingCountMetafield?: RawMetafield,
  judgemeBadgeMetafield?: RawMetafield,
): ProductReviews | null {
  // Path 1: structured metafields.
  if (ratingMetafield?.value && ratingCountMetafield?.value) {
    const count = Number.parseInt(ratingCountMetafield.value, 10);
    if (Number.isFinite(count) && count > 0) {
      let rating: number;
      try {
        const parsed = JSON.parse(ratingMetafield.value) as { value?: string };
        rating = parsed.value ? Number.parseFloat(parsed.value) : Number.NaN;
      } catch {
        rating = Number.parseFloat(ratingMetafield.value);
      }
      if (Number.isFinite(rating) && rating >= 0) return { rating, count };
    }
  }
  // Path 2: judgeme.badge HTML fallback.
  if (judgemeBadgeMetafield?.value) {
    return parseJudgemeBadgeHtml(judgemeBadgeMetafield.value);
  }
  return null;
}

/**
 * Extract `data-average-rating` and `data-number-of-reviews` from a
 * Judge.me badge HTML blob. Phase 241.
 *
 * Example input (truncated):
 *   <div class='jdgm-prev-badge' data-average-rating='4.62' data-number-of-reviews='196' ...>
 *
 * Returns null on any malformed input — never throws. The headless
 * gracefully renders the no-reviews UI when this returns null.
 */
function parseJudgemeBadgeHtml(html: string): ProductReviews | null {
  const ratingMatch = /data-average-rating=['"]([0-9.]+)['"]/.exec(html);
  const countMatch = /data-number-of-reviews=['"]([0-9]+)['"]/.exec(html);
  if (!ratingMatch || !countMatch) return null;
  const rating = Number.parseFloat(ratingMatch[1]);
  const count = Number.parseInt(countMatch[1], 10);
  if (!Number.isFinite(rating) || !Number.isFinite(count)) return null;
  if (count <= 0 || rating <= 0) return null;
  return { rating, count };
}

/**
 * Parse the five `custom.*` mattress spec metafields. Each field is
 * independently optional — partial population is fine. Numbers that fail
 * to parse fall back to null so the compare table omits the row.
 */
export function parseSpecMetafields(raw: {
  firmnessMetafield?: RawMetafield;
  heightMetafield?: RawMetafield;
  materialMetafield?: RawMetafield;
  warrantyMetafield?: RawMetafield;
  trialMetafield?: RawMetafield;
}): ProductSpecs {
  const num = (m?: RawMetafield) => {
    if (!m?.value) return null;
    const n = Number.parseFloat(m.value);
    return Number.isFinite(n) ? n : null;
  };
  return {
    firmness:      raw.firmnessMetafield?.value || null,
    heightInches:  num(raw.heightMetafield),
    materialType:  raw.materialMetafield?.value || null,
    warrantyYears: num(raw.warrantyMetafield),
    trialNights:   num(raw.trialMetafield),
  };
}

/**
 * Parse the eight `custom.*` editorial metafields (Phase 94). Each is
 * independently optional — sections render only when their metafield has
 * a populated value. Unknown / malformed JSON returns to safe defaults
 * (empty array, null) instead of throwing — the merchant typing JSON in
 * the Admin shouldn't bring the PDP down.
 */
function parseStringList(raw: RawMetafield | undefined): string[] {
  if (!raw?.value) return [];
  try {
    const parsed = JSON.parse(raw.value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  } catch {
    return [];
  }
}

const VALID_FIT: ReadonlySet<SleepPositionFit> = new Set(['great', 'good', 'poor']);

function parseEditorialMetafields(raw: {
  taglineMetafield?: RawMetafield;
  ledeMetafield?: RawMetafield;
  bestForMetafield?: RawMetafield;
  notIdealForMetafield?: RawMetafield;
  highlightsMetafield?: RawMetafield;
  firmnessScoreMetafield?: RawMetafield;
  positionFitMetafield?: RawMetafield;
  layersMetafield?: RawMetafield;
}): ProductEditorial {
  let highlights: ProductHighlight[] = [];
  if (raw.highlightsMetafield?.value) {
    try {
      const parsed = JSON.parse(raw.highlightsMetafield.value) as unknown;
      if (Array.isArray(parsed)) {
        highlights = parsed
          .filter((h): h is ProductHighlight =>
            typeof h === 'object' && h !== null &&
            typeof (h as ProductHighlight).title === 'string' &&
            typeof (h as ProductHighlight).body === 'string',
          )
          .slice(0, 4);
      }
    } catch { /* malformed JSON — fall back to empty list */ }
  }

  let layers: ProductLayer[] = [];
  if (raw.layersMetafield?.value) {
    try {
      const parsed = JSON.parse(raw.layersMetafield.value) as unknown;
      if (Array.isArray(parsed)) {
        layers = parsed.filter((l): l is ProductLayer =>
          typeof l === 'object' && l !== null &&
          typeof (l as ProductLayer).name === 'string' &&
          typeof (l as ProductLayer).desc === 'string',
        );
      }
    } catch { /* fall back */ }
  }

  let positionFit: ProductEditorial['positionFit'] = null;
  if (raw.positionFitMetafield?.value) {
    try {
      const parsed = JSON.parse(raw.positionFitMetafield.value) as Record<string, unknown>;
      const safe = (k: string): SleepPositionFit | undefined => {
        const v = parsed[k];
        return typeof v === 'string' && VALID_FIT.has(v as SleepPositionFit)
          ? (v as SleepPositionFit)
          : undefined;
      };
      const out = { back: safe('back'), side: safe('side'), stomach: safe('stomach') };
      if (out.back || out.side || out.stomach) positionFit = out;
    } catch { /* fall back */ }
  }

  let firmnessScore: number | null = null;
  if (raw.firmnessScoreMetafield?.value) {
    const n = Number.parseInt(raw.firmnessScoreMetafield.value, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 10) firmnessScore = n;
  }

  // Lists of single-line strings come back as JSON-encoded arrays even
  // though the metafield type is list.single_line_text_field.
  return {
    tagline:       raw.taglineMetafield?.value || null,
    lede:          raw.ledeMetafield?.value || null,
    bestFor:       parseStringList(raw.bestForMetafield),
    notIdealFor:   parseStringList(raw.notIdealForMetafield),
    highlights,
    firmnessScore,
    positionFit,
    layers,
  };
}

// Memoized so the products/[handle] segment layout (JSON-LD) and the
// page's ProductBody share a single Storefront request per render.
export const getProductByHandle = cache(async (handle: string): Promise<Product | null> => {
  const data = await shopifyFetch<Raw, { handle: string }>(
    GET_PRODUCT_BY_HANDLE,
    { handle },
    { tags: [`product:${handle}`] },
  );
  if (!data.product) return null;
  const {
    ratingMetafield, ratingCountMetafield, judgemeBadgeMetafield,
    firmnessMetafield, heightMetafield, materialMetafield, warrantyMetafield, trialMetafield,
    taglineMetafield, ledeMetafield, bestForMetafield, notIdealForMetafield,
    highlightsMetafield, firmnessScoreMetafield, positionFitMetafield, layersMetafield,
    ...rest
  } = data.product;
  return {
    ...rest,
    images: data.product.images.nodes,
    variants: data.product.variants.nodes,
    reviews: parseReviewsMetafields(ratingMetafield, ratingCountMetafield, judgemeBadgeMetafield),
    specs: parseSpecMetafields({
      firmnessMetafield, heightMetafield, materialMetafield, warrantyMetafield, trialMetafield,
    }),
    editorial: parseEditorialMetafields({
      taglineMetafield, ledeMetafield, bestForMetafield, notIdealForMetafield,
      highlightsMetafield, firmnessScoreMetafield, positionFitMetafield, layersMetafield,
    }),
  };
});
