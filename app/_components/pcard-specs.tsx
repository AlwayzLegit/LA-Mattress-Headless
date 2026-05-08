import type { ProductSummary } from '@/lib/shopify';

/**
 * Type / Firmness pill row rendered on PLP + search result cards. Mirrors
 * the design handoff's `.plp-card-tags` — two small grey pills for the
 * primary buying-decision filters (material type + firmness). Height
 * intentionally not surfaced here; it lives in the spec table on the PDP.
 *
 * Returns null when neither tag is populated (non-mattress products in
 * mixed PLPs, or merchant hasn't annotated yet).
 */
export function PcardSpecs({ specs }: { specs?: ProductSummary['specs'] }) {
  if (!specs) return null;
  const tags: string[] = [];
  if (specs.materialType) tags.push(specs.materialType);
  if (specs.firmness)     tags.push(specs.firmness);
  if (tags.length === 0) return null;
  return (
    <div className="plp-card-tags">
      {tags.map((t) => <span key={t} className="plp-tag">{t}</span>)}
    </div>
  );
}
