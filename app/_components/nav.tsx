'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './icon';
import { phImg, type PhFit } from './images';
import { useCart } from './cart-context';
import { HeaderSearch } from './header-search';
import { NavSaved } from './nav-saved';
import { useBodyScrollLock } from './use-body-scroll-lock';
import { SITE_PHONE_TEL } from '@/lib/site-config';

type MegaCol = { title: string; links: { label: string; href: string }[] };
type MegaTile = {
  eyebrow: string;
  title: string;
  href: string;
  img: string;
  fit?: PhFit;
};
type MegaKey = 'mattresses' | 'brands' | 'learn';

const NAV_ITEMS: { label: string; mega: MegaKey | null; href: string; accent?: boolean }[] = [
  { label: 'Mattresses',     mega: 'mattresses', href: '/collections/mattresses' },
  { label: 'Adjustable Beds', mega: null,        href: '/collections/adjustable-beds' },
  { label: 'Brands',          mega: 'brands',    href: '/collections/mattresses' },
  { label: 'Bedding',         mega: null,        href: '/collections/sheets-pillowcases' },
  { label: 'Stores',          mega: null,        href: '/pages/mattress-store-locations' },
  { label: 'Financing',       mega: null,        href: '/pages/mattress-store-financing' },
  { label: 'Deals',           mega: null,        href: '/collections/on-sale', accent: true },
  { label: 'Guides',          mega: 'learn',     href: '/pages/mattress-types' },
];

const MEGA: Record<MegaKey, { cols: MegaCol[]; tiles: MegaTile[] }> = {
  mattresses: {
    cols: [
      { title: 'By Type', links: [
        { label: 'Memory Foam',  href: '/collections/memory-foam-mattresses' },
        { label: 'Hybrid',       href: '/collections/hybrid-mattresses' },
        { label: 'Innerspring',  href: '/collections/innerspring-mattresses' },
        { label: 'Latex',        href: '/collections/latex-mattresses' },
        { label: 'Compare all four →', href: '/pages/mattress-types' },
      ]},
      { title: 'By Size', links: [
        { label: 'Twin',            href: '/collections/twin-size-mattresses' },
        { label: 'Twin XL',         href: '/collections/twin-xl-mattress-sale' },
        { label: 'Full',            href: '/collections/full-size-mattresses' },
        { label: 'Queen',           href: '/collections/queen-size-mattresses' },
        { label: 'King',            href: '/collections/king-size-mattresses' },
        { label: 'California King', href: '/collections/california-king-mattresses' },
        { label: 'Size guide →',    href: '/pages/mattress-sizes' },
      ]},
      { title: 'Adjacent', links: [
        { label: 'Adjustable bases',   href: '/collections/adjustable-beds' },
        { label: 'Bedding & sheets',   href: '/collections/sheets-pillowcases' },
        { label: 'Mattress toppers',   href: '/collections/mattress-toppers' },
        { label: 'Take the sleep quiz →', href: '/sleep-quiz' },
      ]},
    ],
    tiles: [
      { eyebrow: 'Bestseller',     title: 'Tempur-Pedic ProAdapt', href: '/products/tempur-pedic-tempur-proadapt-medium-hybrid', img: 'product-tempur-proadapt', fit: 'contain-cream' },
      { eyebrow: 'On sale · −25%', title: 'Memorial Day savings',  href: '/collections/on-sale',                                  img: 'lifestyle-couple' },
    ],
  },
  brands: {
    cols: [
      { title: 'Premium', links: [
        { label: 'Tempur-Pedic',     href: '/collections/tempur-pedic-mattresses' },
        { label: 'Stearns & Foster', href: '/collections/stearns-foster-mattresses' },
        { label: 'Chattam & Wells',  href: '/collections/chattam-wells-mattresses' },
      ]},
      { title: 'Performance', links: [
        { label: 'Helix',      href: '/collections/helix-mattresses' },
        { label: 'Diamond',    href: '/collections/diamond-mattresses' },
        { label: 'Spring Air', href: '/collections/spring-air-mattresses' },
      ]},
      { title: 'Value', links: [
        { label: 'Eastman House',  href: '/collections/eastman-house-mattresses' },
        { label: 'Harvest Green',  href: '/collections/harvest-mattresses' },
        { label: 'Englander',      href: '/collections/englander-mattresses' },
      ]},
    ],
    tiles: [
      { eyebrow: 'Featured', title: 'The Tempur-Pedic Collection', href: '/collections/tempur-pedic-mattresses', img: 'product-tempur-proadapt', fit: 'contain-cream' },
      { eyebrow: 'Limited',  title: 'Stearns & Foster Reserve',    href: '/collections/stearns-foster-mattresses', img: 'product-stearns-foster',  fit: 'contain-cream' },
    ],
  },
  learn: {
    cols: [
      { title: 'Buying guides', links: [
        { label: 'How to pick a size',                href: '/pages/mattress-sizes' },
        { label: 'Foam vs hybrid vs spring vs latex', href: '/pages/mattress-types' },
        { label: 'Top brands',                         href: '/pages/mattress-brands' },
      ]},
      { title: 'Customer support', links: [
        { label: 'Delivery & setup',     href: '/pages/mattress-store-delivery' },
        { label: '120-night trial',      href: '/pages/love-your-bed-guarantee' },
        { label: 'Warranty coverage',    href: '/pages/warranty' },
        { label: 'Contact us',            href: '/pages/mattress-store-contact' },
        { label: 'About LA Mattress',    href: '/pages/about' },
      ]},
      { title: 'Tools', links: [
        { label: 'Sleep quiz',          href: '/sleep-quiz' },
        { label: 'Find a showroom',     href: '/pages/mattress-store-locations' },
      ]},
    ],
    tiles: [
      { eyebrow: 'Most-read', title: 'The 30-minute buying guide',     href: '/pages/mattress-types', img: 'lifestyle-bedroom' },
      { eyebrow: 'Free',      title: 'Take the 8-question sleep quiz', href: '/sleep-quiz',           img: 'lifestyle-couple' },
    ],
  },
};

export function Nav() {
  const [mega, setMega] = useState<MegaKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count, openDrawer } = useCart();

  // Lock background scroll while the mobile drawer is open. Stack-
  // aware via the shared hook so it composes with the cart drawer,
  // search overlay, and mobile filter shell.
  useBodyScrollLock(mobileOpen);

  return (
    <>
      <header className="nav" onMouseLeave={() => setMega(null)}>
        <div className="container nav-inner">
          <Link href="/" className="logo" aria-label="LA Mattress">
            <Image
              src="/assets/la-mattress-logo.png"
              alt="LA Mattress"
              className="logo-img"
              width={400}
              height={224}
              priority
            />
          </Link>
          <nav className="nav-items">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`nav-item ${item.accent ? 'nav-item-accent' : ''} ${mega === item.mega ? 'nav-item-on' : ''}`}
                onMouseEnter={() => setMega(item.mega)}
                onFocus={() => setMega(item.mega)}
                onKeyDown={(e) => {
                  // Open mega menu via keyboard. Down opens; Esc closes.
                  if (item.mega && (e.key === 'ArrowDown' || e.key === ' ')) {
                    e.preventDefault();
                    setMega(item.mega);
                  } else if (e.key === 'Escape') {
                    setMega(null);
                  }
                }}
                aria-expanded={item.mega ? mega === item.mega : undefined}
                aria-haspopup={item.mega ? 'menu' : undefined}
              >
                {item.label}
                {item.mega ? <Icon name="chevron-down" size={14} /> : null}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            <HeaderSearch />
            <NavSaved />
            <Link className="icon-btn" aria-label="Account" href="/account"><Icon name="user" size={18} /></Link>
            <button
              className="icon-btn cart-btn"
              aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
              type="button"
              onClick={openDrawer}
            >
              <Icon name="cart" size={18} />
              {count > 0 ? <span className="cart-count">{count}</span> : null}
            </button>
            <button
              className="icon-btn mobile-only"
              aria-label="Menu"
              type="button"
              onClick={() => setMobileOpen(true)}
            >
              <Icon name="menu" size={20} />
            </button>
          </div>
        </div>
        {mega && MEGA[mega] ? (
          <div
            className="mega"
            onMouseLeave={() => setMega(null)}
            onKeyDown={(e) => { if (e.key === 'Escape') setMega(null); }}
            role="menu"
          >
            <div className="container mega-inner">
              <div className="mega-cols">
                {MEGA[mega].cols.map((c) => (
                  <div key={c.title} className="mega-col">
                    <div className="eyebrow">{c.title}</div>
                    <ul>
                      {c.links.map((l) => (
                        <li key={l.label}><Link href={l.href}>{l.label}</Link></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mega-tiles">
                {MEGA[mega].tiles.map((t) => (
                  <Link key={t.title} className="mega-tile" href={t.href}>
                    <div className="ph mega-tile-img" {...phImg(t.img, t.fit ?? 'cover')} />
                    <div className="mega-tile-meta">
                      <div className="eyebrow">{t.eyebrow}</div>
                      <div className="mega-tile-title">{t.title} <Icon name="arrow-up-right" size={14} /></div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {mobileOpen ? (
        <div className="mobile-drawer" role="dialog" aria-label="Site menu">
          <div className="mobile-drawer-hd">
            <Image
              src="/assets/la-mattress-logo.png"
              alt="LA Mattress"
              className="logo-img"
              width={400}
              height={224}
            />
            <button className="icon-btn" type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <Icon name="close" size={22} />
            </button>
          </div>
          <ul className="mobile-list">
            {NAV_ITEMS.map((i) => (
              <li key={i.label}>
                <Link href={i.href} onClick={() => setMobileOpen(false)}>
                  {i.label} <Icon name="chevron-right" size={16} />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mobile-foot">
            <Link href="/pages/mattress-store-locations" className="topbar-link"><Icon name="pin" size={14} /> Find a store</Link>
            <a href={`tel:${SITE_PHONE_TEL}`} className="topbar-link"><Icon name="phone" size={14} /> Call</a>
          </div>
        </div>
      ) : null}
    </>
  );
}
