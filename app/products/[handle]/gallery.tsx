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
 * PDP gallery — matches the design system handoff (pdp-showroom.css §Gallery).
 *
 * Structure:
 *   .pdp-gallery
 *     .pdp-gallery-main
 *       img.pdp-main-img    1:1 aspect, r-4 radius, object-fit: contain
 *       .pdp-gallery-controls (counter overlay "01 / 05")
 *     .pdp-thumbs
 *       button.pdp-thumb (× up to 5)   1:1 aspect, r-3 radius
 *
 * The thumbs use absolutely-positioned <Image fill /> so the wrapper's
 * aspect-ratio:1 is the source of truth (avoids the previous Image
 * width/height + style:100% mismatch that produced uneven sizing).
 *
 * Server-side fallback (no JS) still shows the featured image at full
 * resolution since the initial `selected` index is 0.
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
        <div className="pdp-gallery-main">
          <div className="ph pdp-main-img">
            <span className="ph-label">[Image coming]</span>
          </div>
        </div>
      </section>
    );
  }

  const hero = all[selected] ?? all[0];

  return (
    <section className="pdp-gallery">
      <div className="pdp-gallery-main">
        <div className="pdp-main-img">
          <Image
            src={hero.url}
            alt={hero.altText ?? productTitle}
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            style={{ objectFit: 'contain' }}
            priority={selected === 0}
            key={hero.url}
          />
        </div>
        {all.length > 1 ? (
          <div className="pdp-gallery-controls">
            <span className="mono pdp-gallery-counter">
              {String(selected + 1).padStart(2, '0')} / {String(all.length).padStart(2, '0')}
            </span>
          </div>
        ) : null}
      </div>
      {all.length > 1 ? (
        <div className="pdp-thumbs" role="tablist" aria-label="Product images">
          {all.map((img, i) => (
            <button
              key={img.url}
              type="button"
              role="tab"
              aria-selected={selected === i}
              aria-label={`View image ${i + 1} of ${all.length}`}
              className={`pdp-thumb${selected === i ? ' on' : ''}`}
              onClick={() => setSelected(i)}
            >
              <Image
                src={img.url}
                alt={img.altText ?? `${productTitle} view ${i + 1}`}
                fill
                sizes="120px"
                style={{ objectFit: 'contain' }}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
