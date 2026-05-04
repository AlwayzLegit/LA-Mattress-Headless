'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './icon';

type MegaCol = { title: string; links: { label: string; href: string }[] };
type MegaTile = { eyebrow: string; title: string; label: string; href: string };
type MegaKey = 'mattresses' | 'brands' | 'learn';

const NAV_ITEMS: { label: string; mega: MegaKey | null; href: string; accent?: boolean }[] = [
  { label: 'Mattresses',     mega: 'mattresses', href: '/collections/mattresses' },
  { label: 'Adjustable Beds', mega: null,        href: '/collections/adjustable-beds' },
  { label: 'Brands',          mega: 'brands',    href: '/collections/mattresses' },
  { label: 'Bedding',         mega: null,        href: '/collections/sheets-pillowcases' },
  { label: 'Stores',          mega: null,        href: '/pages/mattress-store-locations' },
  { label: 'Financing',       mega: null,        href: '/pages/mattress-store-financing' },
  { label: 'Deals',           mega: null,        href: '/collections/on-sale', accent: true },
  { label: 'Guides',          mega: 'learn',     href: '/pages/mattress-guides' },
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
      { eyebrow: 'Bestseller',    title: 'Tempur-Pedic ProAdapt', label: '[Mattress cutout — 600x600]', href: '/products/tempur-pedic-tempur-proadapt-medium-hybrid' },
      { eyebrow: 'On sale · −25%', title: 'Memorial Day savings',   label: '[Sale — 600x600]',           href: '/collections/on-sale' },
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
      { eyebrow: 'Featured', title: 'The Tempur-Pedic Collection', label: '[Brand lifestyle — 600x600]', href: '/collections/tempur-pedic-mattresses' },
      { eyebrow: 'Limited',  title: 'Stearns & Foster Reserve',    label: '[Brand lifestyle — 600x600]', href: '/collections/stearns-foster-mattresses' },
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
      { eyebrow: 'Most-read', title: 'The 30-minute buying guide',     label: '[Editorial — 600x600]', href: '/pages/mattress-types' },
      { eyebrow: 'Free',      title: 'Take the 8-question sleep quiz', label: '[Quiz — 600x600]',      href: '/sleep-quiz' },
    ],
  },
};

export function Nav() {
  const [mega, setMega] = useState<MegaKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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
              >
                {item.label}
                {item.mega ? <Icon name="chevron-down" size={14} /> : null}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            <button className="icon-btn" aria-label="Search" type="button"><Icon name="search" size={18} /></button>
            <Link className="icon-btn" aria-label="Account" href="/account"><Icon name="user" size={18} /></Link>
            <button className="icon-btn cart-btn" aria-label="Cart" type="button">
              <Icon name="cart" size={18} />
              <span className="cart-count">0</span>
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
          <div className="mega" onMouseLeave={() => setMega(null)}>
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
                    <div className="ph mega-tile-img"><span className="ph-label">{t.label}</span></div>
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
            <a href="tel:+12135550142" className="topbar-link"><Icon name="phone" size={14} /> Call</a>
          </div>
        </div>
      ) : null}
    </>
  );
}
