// Phase 163: server component. Only the scroll buttons need client
// hydration — the product cards and section chrome are static. The
// scroll button island uses document.getElementById to locate the
// rail rather than sharing a ref, so the cards can stay server-only.

import Link from 'next/link';
import { Icon } from '../icon';
import { phImg } from '../images';
import { RailScrollButtons } from './rail-scroll-buttons';

type Product = {
  brand: string;
  name: string;
  price: number;
  was?: number;
  monthly: number;
  tag?: string;
  tagKind?: 'sale';
  img: string;
  imgLabel: string;
  href: string;
};

/**
 * Hardcoded sample matching the design's PRODUCTS table. Real Storefront
 * product data swap comes in Phase 1. Several handles already align to live
 * Shopify products (verified via Admin API earlier this session).
 *
 * Star ratings + review counts intentionally NOT shown until a reviews
 * vendor (Birdeye / Yotpo) is wired. Fabricated review counts are an
 * FTC compliance risk — Phase 22 stripped them; the .pcard-rating CSS hook
 * stays in place for the post-vendor wire-up.
 */
const PRODUCTS: Product[] = [
  { brand: 'Tempur-Pedic',     name: 'TEMPUR-ProAdapt Medium Hybrid',         price: 3499, was: 4199, monthly: 58, tag: 'Bestseller',   img: 'product-tempur-proadapt', imgLabel: '[Tempur-Pedic ProAdapt]',  href: '/products/tempur-pedic-tempur-proadapt-medium-hybrid' },
  { brand: 'Stearns & Foster', name: 'Lux Estate® Ultra Firm 14.5"',          price: 4299, was: 4899, monthly: 72, tag: 'New',          img: 'product-stearns-foster',  imgLabel: '[Stearns & Foster Reserve]', href: '/products/the-luxe-estate-firm-by-stearns-foster' },
  { brand: 'Helix',             name: 'Midnight Luxe — Medium-Firm',           price: 1949,            monthly: 33, tag: 'Editor’s pick', img: 'product-helix',         imgLabel: '[Helix Midnight]',          href: '/products/helix-sleep-core-collection-midnight-luxe-medium-13-5-mattress' },
  { brand: 'Diamond',           name: 'Diamond Rock Extra Firm 12"',           price: 1599, was: 1899, monthly: 27, tag: '−16%',     tagKind: 'sale', img: 'product-diamond', imgLabel: '[Diamond cutout]',           href: '/products/rock-extra-firm-mattress-diamond-mattress' },
  { brand: 'Spring Air',        name: 'Back Supporter Plush Euro Top',         price: 1199,            monthly: 20,                       img: 'product-spring-air',     imgLabel: '[Spring Air cutout]',       href: '/products/spring-air-back-supporter-francesca-plush-mattress' },
  { brand: 'Eastman House',     name: 'Avalon Latex Hybrid Firm 13"',          price: 1399,            monthly: 24, tag: 'Local make',   img: 'product-eastman-house',  imgLabel: '[Eastman House]',           href: '/products/eastman-house-avalon-late-firm' },
  { brand: 'Chattam & Wells',   name: 'Lismore Luxury Firm 13"',                price: 3199,            monthly: 53,                       img: 'product-chattam-wells',  imgLabel: '[Chattam & Wells]',         href: '/products/lismore-luxury-firm-mattress-palace-collection-by-chattam-wells' },
  { brand: 'Eclipse',            name: 'Ice Tufted Firm Euro Top 15"',          price: 1099, was: 1299, monthly: 19, tag: '−15%', tagKind: 'sale', img: 'product-eclipse', imgLabel: '[Eclipse cutout]',         href: '/products/eclipse-glacier-tufted-firm-euro-top-15-mattress' },
];

function ProductCard({ p }: { p: Product }) {
  return (
    <Link href={p.href} className="pcard">
      <div className="ph pcard-img" {...phImg(p.img, 'contain-cream')}>
        <span className="ph-label">{p.imgLabel}</span>
        {p.tag ? (
          <span className={`pcard-tag ${p.tagKind === 'sale' ? 'pcard-tag-sale' : ''}`}>{p.tag}</span>
        ) : null}
      </div>
      <div className="pcard-meta">
        <div className="pcard-brand">{p.brand}</div>
        <div className="pcard-name">{p.name}</div>
        {/* Star rating block intentionally omitted until reviews vendor is
            wired (Birdeye / Yotpo). Fabricated counts are an FTC risk. */}
        <div className="pcard-price">
          {p.was ? <span className="pcard-was tnum">${p.was.toLocaleString()}</span> : null}
          <span className="pcard-now tnum">${p.price.toLocaleString()}</span>
          <span className="pcard-fin muted">/ from ${p.monthly}/mo</span>
        </div>
      </div>
    </Link>
  );
}

const RAIL_ID = 'popular-products-rail';

export function PopularProducts() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">Popular Now</div>
            <h2 className="h2">Most-shopped mattresses<br />this month.</h2>
          </div>
          <div className="section-head-right">
            <Link href="/collections/popular" className="link-arrow">Shop all <Icon name="arrow-right" size={14} /></Link>
            <RailScrollButtons
              railId={RAIL_ID}
              leftLabel="Scroll popular mattresses left"
              rightLabel="Scroll popular mattresses right"
            />
          </div>
        </div>
      </div>
      <div className="pcard-scroll-wrap">
        <div id={RAIL_ID} className="pcard-scroll no-scrollbar">
          {PRODUCTS.map((p, i) => <ProductCard key={i} p={p} />)}
        </div>
      </div>
    </section>
  );
}
