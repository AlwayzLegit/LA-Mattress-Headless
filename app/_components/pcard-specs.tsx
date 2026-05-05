import type { ProductSummary } from '@/lib/shopify';

/**
 * Tight one-line spec strip rendered on PLP / search result cards. Shows
 * Material · Firmness · Height when populated. Returns null when the
 * product has no specs (non-mattress products in mixed PLPs, or items
 * the merchant hasn't yet annotated).
 */
export function PcardSpecs({ specs }: { specs?: ProductSummary['specs'] }) {
  if (!specs) return null;
  const items: string[] = [];
  if (specs.materialType) items.push(specs.materialType);
  if (specs.firmness)     items.push(specs.firmness);
  if (specs.heightInches !== null && specs.heightInches !== undefined) {
    items.push(`${specs.heightInches}"`);
  }
  if (items.length === 0) return null;
  return <div className="pcard-specs">{items.join(' · ')}</div>;
}
