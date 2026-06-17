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
