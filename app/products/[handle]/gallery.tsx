'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Image as ShopifyImage } from '@/lib/shopify';

type Props = {
  productTitle: string;
  featured: ShopifyImage | null;
  images: ShopifyImage[];
};

/**
 * PDP gallery: click any thumb to swap the hero image. The featured image
 * leads off, followed by the rest of product.images (deduped). Selecting a
 * thumb is purely visual — it doesn't change the variant or the URL.
 *
 * Server-side fallback (no JS) still shows the featured image at full
 * resolution since the initial `selected` index is 0; thumbs gracefully
 * stay non-interactive without breaking layout.
 */
export function PdpGallery({ productTitle, featured, images }: Props) {
  // Build the unique image list. Featured image first, then images[] minus
  // any that match the featured URL to avoid duplicates.
  const all: ShopifyImage[] = (() => {
    const out: ShopifyImage[] = [];
    if (featured) out.push(featured);
    for (const img of images) {
      if (!out.some((existing) => existing.url === img.url)) out.push(img);
    }
    return out.slice(0, 8);
  })();

  const [selected, setSelected] = useState(0);

  if (all.length === 0) {
    return (
      <section className="pdp-gallery">
        <div className="ph pdp-hero-img">
          <span className="ph-label">[Image coming]</span>
        </div>
      </section>
    );
  }

  const hero = all[selected] ?? all[0];

  return (
    <section className="pdp-gallery">
      <Image
        src={hero.url}
        alt={hero.altText ?? productTitle}
        width={1200}
        height={1200}
        className="pdp-hero-img"
        sizes="(max-width: 880px) 100vw, 60vw"
        priority={selected === 0}
        key={hero.url}
      />
      {all.length > 1 ? (
        <div className="pdp-thumbs" role="tablist" aria-label="Product images">
          {all.map((img, i) => (
            <button
              key={img.url}
              type="button"
              role="tab"
              aria-selected={selected === i}
              aria-label={`View image ${i + 1} of ${all.length}`}
              className={`pdp-thumb-btn${selected === i ? ' is-selected' : ''}`}
              onClick={() => setSelected(i)}
            >
              <Image
                src={img.url}
                alt={img.altText ?? `${productTitle} view ${i + 1}`}
                width={200}
                height={200}
                className="pdp-thumb"
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
