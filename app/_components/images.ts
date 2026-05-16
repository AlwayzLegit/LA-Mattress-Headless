import type { CSSProperties, HTMLAttributes } from 'react';

// Phase 234: lifestyle/section backgrounds dropped to q=65 + capped to
// the actual displayed width. These are decorative photographic
// backgrounds (page sections, mega-tile thumbnails, category cards)
// rendered as CSS background-image — they don't pass through next/image,
// so the URL params are what the browser actually fetches. Cowork rev-5
// caught the previous `?w=1600&q=80` lifestyle photos coming in at
// 454 KB on the homepage; q=65 + 1280w trims them roughly in half with
// no perceptible quality loss for this content type. Hero/product
// images that DO pass through next/image are unaffected — next/image
// rewrites the q param on its own via the `quality` prop in
// `hero-slide-image.tsx` (also lowered to 65 in this phase).
const FALLBACK_BEDROOM =
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1280&q=65&auto=format&fit=crop';
const FALLBACK_PRODUCT =
  'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=800&q=65&auto=format&fit=crop';

export const IMAGES: Record<string, string> = {
  // Hero
  'hero-showroom':     'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=1280&q=65&auto=format&fit=crop',
  'hero-engineered':   'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1280&q=65&auto=format&fit=crop',
  'hero-sale':         'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1280&q=65&auto=format&fit=crop',

  // Product cutouts (LA Mattress Shopify CDN)
  'product-tempur-proadapt':   'https://cdn.shopify.com/s/files/1/0684/1759/files/pro-adapt-soft-cover.jpg?v=1739813427&width=800',
  'product-tempur-adapt':      'https://cdn.shopify.com/s/files/1/0684/1759/files/Screenshot2024-05-06115034-COVER.jpg?v=1739812938&width=800',
  'product-stearns-foster':    'https://cdn.shopify.com/s/files/1/0684/1759/files/Eastman_House_Spruce_Medium_Pillow_Top_11_Mattress_ec7bfd5e-df73-427c-81eb-197ff71b30f7.png?v=1775395336&width=800',
  'product-helix':             'https://cdn.shopify.com/s/files/1/0684/1759/files/PEACEFULNESSROOMVIEWcopy.jpg?v=1739808275&width=800',
  'product-diamond':           'https://cdn.shopify.com/s/files/1/0684/1759/files/Diamond_Dreamstage_Value_Firm_Tight_Top_b9dfd81e-5d64-4bc8-afaf-865406f0ff60.png?v=1775395335&width=800',
  'product-spring-air':        'https://cdn.shopify.com/s/files/1/0684/1759/files/Spring_Air_Value_Collection_Olive_Firm_8_Mattress_974cfaf5-f78d-4d8d-a263-9fcc4e0beb0d.png?v=1775395335&width=800',
  'product-eastman-house':     'https://cdn.shopify.com/s/files/1/0684/1759/files/Eastman_House_Spruce_Firm_9_Mattress_ff448687-f497-4fbf-9ce8-0985fcd28b71.png?v=1775395334&width=800',
  'product-chattam-wells':     'https://cdn.shopify.com/s/files/1/0684/1759/files/HarvestGreenEssentialGOTSCertified10Mattress.jpg?v=1739811316&width=800',
  'product-eclipse':           'https://cdn.shopify.com/s/files/1/0684/1759/files/Carousel_-_Elite_-_Plus_-_05_csqszn.jpg?v=1772572000&width=800',
  'product-harvest-green':     'https://cdn.shopify.com/s/files/1/0684/1759/files/HarvestGreenEssentialGOTSCertified10Mattress.jpg?v=1739811316&width=800',

  // Categories
  'cat-memory-foam':   'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&q=65&auto=format&fit=crop',
  'cat-hybrid':        'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&q=65&auto=format&fit=crop',
  'cat-innerspring':   'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&q=65&auto=format&fit=crop',
  'cat-latex':         'https://images.unsplash.com/photo-1592229505726-ca121723b8ef?w=800&q=65&auto=format&fit=crop',
  'cat-cooling':       'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800&q=65&auto=format&fit=crop',
  'cat-adjustable':    'https://cdn.shopify.com/s/files/1/0684/1759/files/Carousel_-_Elite_-_Plus_-_05_csqszn.jpg?v=1772572000&width=800',

  // Showrooms — Phase 237: migrated 4 of 5 URLs from
  // mattressstoreslosangeles.com/images/locations/*.jpg (Hydrogen-only
  // path that will 404 once DNS flips to this headless site) onto
  // Shopify CDN. These are the same files lib/showrooms.ts already
  // uses in its `imageUrl` field, so we now have a single CDN-served
  // source per showroom.
  'showroom-koreatown':    'https://cdn.shopify.com/s/files/1/0684/1759/files/Koreatown.jpg?v=1734092287',
  'showroom-west-la':      'https://cdn.shopify.com/s/files/1/0684/1759/files/West_LA.jpg?v=1734092103',
  'showroom-hancock-park': 'https://cdn.shopify.com/s/files/1/0684/1759/files/Los_Angeles_Mattress_Stores_Inside.png?v=1734095081&width=1600',
  'showroom-studio-city':  'https://cdn.shopify.com/s/files/1/0684/1759/files/Studio_City.jpg?v=1734378534',
  'showroom-glendale':     'https://cdn.shopify.com/s/files/1/0684/1759/files/Glendale.jpg?v=1734092279',

  // Lifestyle
  // Original photo-1616627781901-92f81a36c4d6 was 404'd by Unsplash; reusing
  // the lifestyle-bedroom photo here until a real brand asset is supplied.
  // Confirmed 200 OK at time of Phase 22 commit.
  'lifestyle-couple':   'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1280&q=65&auto=format&fit=crop',
  'lifestyle-bedroom':  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1280&q=65&auto=format&fit=crop',
};

export function imgUrl(name: string, fallbackKind: 'product' | 'bedroom' = 'bedroom'): string {
  return IMAGES[name] ?? (fallbackKind === 'product' ? FALLBACK_PRODUCT : FALLBACK_BEDROOM);
}

export type PhFit = 'cover' | 'contain' | 'contain-cream';
export type PhTint = 'warm' | 'dark';

type PhAttrs = HTMLAttributes<HTMLDivElement> & {
  'data-img'?: string;
  'data-fit'?: PhFit;
  'data-tint'?: PhTint;
  style: CSSProperties & Record<'--ph-img', string>;
};

/**
 * Spread onto a `.ph` element to paint a real image as its background, e.g.
 *   <div className="ph pcard-img" {...phImg('product-tempur-proadapt', 'contain-cream')}>
 */
export function phImg(name: string, fit: PhFit = 'cover', tint?: PhTint): PhAttrs {
  const url = imgUrl(name, fit.startsWith('contain') ? 'product' : 'bedroom');
  const out: PhAttrs = {
    'data-img': name,
    style: { '--ph-img': `url("${url}")` } as CSSProperties & Record<'--ph-img', string>,
  };
  if (fit !== 'cover') out['data-fit'] = fit;
  if (tint) out['data-tint'] = tint;
  return out;
}
