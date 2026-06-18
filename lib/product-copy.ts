/**
 * Factual, data-derived PDP body copy.
 *
 * Why this exists (SEMrush 20260616 on-page audit): issue 112 "low
 * text-to-HTML ratio" flagged ~1,033 product URLs (ratios 0.02–0.04).
 * Root cause — the PDP "About this mattress" section in
 * app/(storefront)/products/[handle]/page.tsx renders ONLY when the
 * merchant authored a Shopify product description (`descriptionHtml`).
 * When it's empty the whole section vanishes, leaving a chrome-heavy
 * page with almost no body prose. The merchant catalog can't be
 * backfilled from here (descriptions live in Shopify Admin and the
 * Admin token is expired), so the fix is a code-side fallback built from
 * the structured fields each product already carries.
 *
 * Every clause is derived from real product data — height, material,
 * firmness, warranty, comfort-trial — with no invented marketing claims,
 * and it interpolates the product's own specs so each PDP gets a
 * distinct paragraph rather than boilerplate. Returns [] when there's
 * nothing factual to say (the caller then renders nothing, exactly as
 * before), so a product with zero populated specs never gets an empty
 * shell of a section.
 *
 * Pure + side-effect-free so it can be unit-tested without a Shopify
 * fetch — `import type` keeps the heavy lib/shopify module out of the
 * runtime graph (erased by Node's type-stripping).
 */
import type { Product } from './shopify/types.ts';
import type { FaqItem } from './faq.ts';

export function buildProductAboutSentences(product: Product): string[] {
  const { specs, editorial } = product;
  const sentences: string[] = [];

  // Identity — "The <title> is a <height>-inch <material> mattress[ from
  // <vendor>]." Only the descriptors that are populated appear; the
  // vendor clause is dropped when the title already names the brand (most
  // titles lead with it) to avoid "The Helix … from Helix".
  const descriptors: string[] = [];
  if (specs.heightInches !== null) descriptors.push(`${specs.heightInches}-inch`);
  const kind = specs.materialType ?? product.productType;
  if (kind) descriptors.push(kind.toLowerCase());
  const noun = descriptors.length ? `${descriptors.join(' ')} mattress` : 'mattress';
  const vendorClause =
    product.vendor && !product.title.toLowerCase().includes(product.vendor.toLowerCase())
      ? ` from ${product.vendor}`
      : '';
  sentences.push(`The ${product.title} is a ${noun}${vendorClause}.`);

  // Feel — firmness label, plus the 1–10 score when the editorial
  // metafield carries one.
  if (specs.firmness) {
    const score =
      editorial.firmnessScore !== null
        ? ` (${editorial.firmnessScore} out of 10 on our firmness scale)`
        : '';
    sentences.push(`It has a ${specs.firmness.toLowerCase()} feel${score}.`);
  }

  // Coverage — manufacturer warranty + our comfort exchange.
  const coverage: string[] = [];
  if (specs.warrantyYears !== null) coverage.push(`a ${specs.warrantyYears}-year manufacturer warranty`);
  if (specs.trialNights !== null) coverage.push(`our ${specs.trialNights}-night comfort exchange`);
  if (coverage.length) {
    const joined = coverage.length === 2 ? `${coverage[0]} and ${coverage[1]}` : coverage[0];
    sentences.push(`It's backed by ${joined}.`);
  }

  return sentences;
}

/**
 * Approximate visible-text length of a Shopify description HTML blob —
 * tags + entities stripped, whitespace collapsed. Used to decide whether
 * a PDP is "thin" enough to warrant the supplemental store-facts block.
 */
export function htmlTextLength(html: string | null | undefined): number {
  if (!html) return 0;
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

/**
 * A merchant description is "thin" when it carries less than this many
 * characters of visible text. Below the threshold the PDP appends the
 * store-facts paragraph (delivery / financing / showroom + internal
 * links) under the merchant copy; an empty description gets the full
 * spec-derived fallback instead. 350 ≈ 2–3 sentences — enough that a
 * genuinely descriptive paragraph is left alone, while one-liners
 * ("Memory foam mattress.") still get reinforced.
 */
export const THIN_DESCRIPTION_CHARS = 350;

export function isThinDescription(html: string | null | undefined): boolean {
  return htmlTextLength(html) < THIN_DESCRIPTION_CHARS;
}

/**
 * Per-product FAQ — store-policy answers (delivery, comfort exchange,
 * financing, showroom) plus the product's own warranty term, with the
 * product name interpolated into the questions so each PDP's FAQPage is
 * distinct rather than 230 identical blocks. Answers are plain prose (no
 * inline links) so faqJsonLd() serializes clean structured data; the
 * visible block runs them through renderFaqAnswer at render time.
 *
 * Every answer is factual and true site-wide — no per-product claims
 * beyond the warranty term, which comes straight from the spec metafield.
 */
export function buildProductFaq(product: Product): FaqItem[] {
  const name = product.title;
  const items: FaqItem[] = [];

  items.push({
    q: `Is delivery free on the ${name}?`,
    a: 'Yes — free white-glove delivery anywhere in Los Angeles on orders over $499, including setup and free haul-away of your old mattress. Order by 4pm for same-day delivery.',
  });

  const trial = product.specs.trialNights ?? 120;
  items.push({
    q: `What if the ${name} isn't comfortable?`,
    a: `You have our ${trial}-night comfort exchange. Sleep on it for at least 30 nights, and if it isn't right, exchange it for another mattress — we handle the pickup and redelivery.`,
  });

  if (product.specs.warrantyYears !== null) {
    items.push({
      q: `What warranty does the ${name} come with?`,
      a: `It's covered by a ${product.specs.warrantyYears}-year manufacturer warranty against defects, and we file warranty claims on your behalf.`,
    });
  }

  items.push({
    q: 'Can I finance this mattress?',
    a: 'Yes — 0% APR financing through Synchrony on approved credit, plus Acima lease-to-own with no credit needed. Most applicants are approved in minutes at checkout or in any showroom.',
  });

  items.push({
    q: `Can I try the ${name} in person?`,
    a: 'Yes — our Los Angeles showrooms in Koreatown, West LA, La Brea, Studio City, and Glendale carry our lineup on the floor. Walk-ins welcome, no appointment needed.',
  });

  return items;
}
