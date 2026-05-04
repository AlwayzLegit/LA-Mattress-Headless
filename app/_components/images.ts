import type { CSSProperties, HTMLAttributes } from 'react';

const FALLBACK_BEDROOM =
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80&auto=format&fit=crop';
const FALLBACK_PRODUCT =
  'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=800&q=80&auto=format&fit=crop';

export const IMAGES: Record<string, string> = {
  // Hero
  'hero-showroom':     'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=2000&q=85&auto=format&fit=crop',
  'hero-engineered':   'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=2000&q=85&auto=format&fit=crop',
  'hero-sale':         'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=2000&q=85&auto=format&fit=crop',

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
  'cat-memory-foam':   'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&q=80&auto=format&fit=crop',
  'cat-hybrid':        'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&q=80&auto=format&fit=crop',
  'cat-innerspring':   'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&q=80&auto=format&fit=crop',
  'cat-latex':         'https://images.unsplash.com/photo-1592229505726-ca121723b8ef?w=800&q=80&auto=format&fit=crop',
  'cat-cooling':       'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800&q=80&auto=format&fit=crop',
  'cat-adjustable':    'https://cdn.shopify.com/s/files/1/0684/1759/files/Carousel_-_Elite_-_Plus_-_05_csqszn.jpg?v=1772572000&width=800',

  // Showrooms
  'showroom-koreatown':    'https://mattressstoreslosangeles.com/images/locations/koreatown-storefront.jpg',
  'showroom-west-la':      'https://mattressstoreslosangeles.com/images/locations/west-la-storefront.jpg',
  'showroom-hancock-park': 'https://cdn.shopify.com/s/files/1/0684/1759/files/Los_Angeles_Mattress_Stores_Inside.png?v=1734095081&width=1600',
  'showroom-studio-city':  'https://mattressstoreslosangeles.com/images/locations/studio-city-storefront.jpg',
  'showroom-glendale':     'https://mattressstoreslosangeles.com/images/locations/glendale-storefront.jpg',

  // Lifestyle
  'lifestyle-couple':   'https://images.unsplash.com/photo-1616627781901-92f81a36c4d6?w=2000&q=85&auto=format&fit=crop',
  'lifestyle-bedroom':  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=2000&q=85&auto=format&fit=crop',
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
