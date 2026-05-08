import type { Product } from '@/lib/shopify';

/**
 * PDP Materials section — design handoff §Materials.
 *
 * Renders ONLY when at least one construction layer is populated. Dark
 * navy background; numbered ordered list (L01, L02, ...) of layer name
 * + description.
 *
 * The design has a cross-section image on the left and the layer list
 * on the right. We don't currently have a per-product cross-section
 * image asset, so the layer list spans full width in our render. When
 * the merchant uploads cross-section images, we can flip the layout
 * back to the design's 1fr/1fr grid.
 */
export function PdpMaterials({ product }: { product: Product }) {
  const layers = product.editorial.layers;
  if (layers.length === 0) return null;

  return (
    <section className="pdp-section pdp-materials section-dark">
      <div className="pdp-section-head">
        <div>
          <div className="eyebrow eyebrow-on-dark">Materials</div>
          <h2 className="h2">{layers.length} layer{layers.length === 1 ? '' : 's'}, working together.</h2>
        </div>
        <p className="muted pdp-section-lede">
          Built for adaptive support and breathability. Every layer is hand-checked
          before it ships from our warehouse.
        </p>
      </div>

      <ol className="pdp-layers">
        {layers.map((l, i) => (
          <li key={`${i}-${l.name}`}>
            <span className="mono pdp-layer-n">L{String(i + 1).padStart(2, '0')}</span>
            <div>
              <div className="pdp-layer-name">{l.name}</div>
              <div className="muted pdp-layer-desc">{l.desc}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
