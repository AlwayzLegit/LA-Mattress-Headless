'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './icon';
import { phImg, type PhFit } from './images';
import { useCart } from './cart-context';
import { useFocusTrap } from './use-focus-trap';
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
  { label: 'Brands',          mega: 'brands',    href: '/pages/mattress-brands' },
  { label: 'Bedding',         mega: null,        href: '/collections/sheets-pillowcases' },
  { label: 'Stores',          mega: null,        href: '/pages/mattress-store-locations' },
  { label: 'Financing',       mega: null,        href: '/pages/mattress-store-financing' },
  { label: 'Deals',           mega: null,        href: '/collections/on-sale', accent: true },
  { label: 'Guides',          mega: 'learn',     href: '/blogs' },
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
        { label: 'Bed frames',         href: '/collections/bed-frames' },
        { label: 'Bedding & sheets',   href: '/collections/sheets-pillowcases' },
        { label: 'Pillows',            href: '/collections/pillows' },
        { label: 'Rize pillows',       href: '/collections/rize-pillows' },
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
        { label: 'How to choose a mattress',  href: '/blogs/mattress-buying-guide/how-to-choose-a-mattress' },
        { label: 'Best for back pain',        href: '/blogs/mattress-buying-guide/best-mattress-for-back-pain' },
        { label: 'Best for side sleepers',    href: '/blogs/mattress-buying-guide/best-mattress-for-side-sleepers' },
        { label: 'How much to spend',         href: '/blogs/mattress-buying-guide/how-much-should-you-spend-on-a-mattress' },
        { label: 'All guides →',              href: '/blogs' },
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
      { eyebrow: 'Most-read', title: 'The complete mattress buying guide', href: '/blogs/mattress-buying-guide/how-to-choose-a-mattress', img: 'lifestyle-bedroom' },
      { eyebrow: 'Free',      title: 'Take the 8-question sleep quiz', href: '/sleep-quiz',           img: 'lifestyle-couple' },
    ],
  },
};

// Brands the store actually stocks — derived live from product vendors
// in the server layout (getBrands) and passed in. When present it
// replaces the static MEGA.brands columns so a newly-onboarded brand
// (e.g. Sleep & Beyond) shows in the nav with no code change. Falls
// back to the hardcoded MEGA.brands columns when the prop is empty
// (Storefront API unconfigured / unreachable).
type NavBrand = { name: string; href: string };

function chunkBrandCols(brands: NavBrand[]): MegaCol[] {
  const perCol = Math.ceil(brands.length / 3);
  const cols: MegaCol[] = [];
  for (let i = 0; i < brands.length; i += perCol) {
    const chunk = brands.slice(i, i + perCol);
    const first = chunk[0].name[0]?.toUpperCase() ?? '';
    const last = chunk[chunk.length - 1].name[0]?.toUpperCase() ?? '';
    cols.push({
      title: first === last ? first : `${first}–${last}`,
      links: chunk.map((b) => ({ label: b.name, href: b.href })),
    });
  }
  return cols;
}

export function Nav({ brands = [] }: { brands?: NavBrand[] }) {
  const [mega, setMega] = useState<MegaKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Which mobile accordion section is expanded (by item label). Single-
  // open: tapping a section collapses any other. Reset when the drawer
  // closes so it reopens clean.
  const [mobileSub, setMobileSub] = useState<string | null>(null);
  const { count, openDrawer } = useCart();

  const closeMobile = () => setMobileOpen(false);

  const brandCols = useMemo(
    () => (brands.length ? chunkBrandCols(brands) : MEGA.brands.cols),
    [brands],
  );

  // When the mega panel opens via keyboard (ArrowDown / Space on the
  // trigger), we need to (a) move focus from the trigger into the
  // panel so the user can keyboard-navigate the links without first
  // Tab-cycling through the entire trigger row, and (b) restore focus
  // back to the trigger on Esc so the user lands somewhere predictable
  // instead of body. Mouse-driven opens (hover) skip both — they don't
  // disturb focus and there's no "previous focus" to restore.
  const megaPanelRef = useRef<HTMLElement>(null);
  const megaTriggerRef = useRef<HTMLElement | null>(null);
  const pendingKbdFocusRef = useRef(false);
  // Phase 221: focus the panel's first link synchronously after the
  // panel commits. The Phase 191 implementation used
  // `useEffect` + `requestAnimationFrame`, which the Cowork pre-launch
  // audit found unreliable — the rAF fired after the panel rendered
  // but the focus call landed on BODY or the trigger anyway, likely
  // a paint-ordering race. `useLayoutEffect` runs synchronously after
  // refs attach, before paint, so `querySelector` sees the just-
  // mounted panel and `focus()` resolves before the browser's own
  // focus fallback can intervene.
  useLayoutEffect(() => {
    if (!mega || !pendingKbdFocusRef.current) return;
    pendingKbdFocusRef.current = false;
    megaPanelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
  }, [mega]);

  // Lock background scroll while the mobile drawer is open. Stack-
  // aware via the shared hook so it composes with the cart drawer,
  // search overlay, and mobile filter shell.
  useBodyScrollLock(mobileOpen);

  // Tab cycles within the mobile drawer; close restores focus to the
  // hamburger menu button.
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(mobileOpen, mobileDrawerRef);

  // Auto-focus the close button when the mobile drawer opens — same
  // pattern as the cart drawer (Phase 109). Lands keyboard / SR users
  // somewhere predictable instead of waiting for them to Tab in.
  // Wrapped in rAF so the drawer is mounted before .focus() runs.
  useEffect(() => {
    if (!mobileOpen) return;
    const id = requestAnimationFrame(() => mobileCloseRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [mobileOpen]);

  // Collapse any expanded accordion section whenever the drawer closes
  // (covers every close path: button, Esc, link tap, focus-trap) so it
  // reopens in a clean, fully-collapsed state.
  useEffect(() => {
    if (!mobileOpen) setMobileSub(null);
  }, [mobileOpen]);

  // Escape closes the mobile drawer — completes the keyboard pattern
  // shared with the cart drawer and search overlay.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // Toggle .nav-scrolled when the visitor has scrolled past the very
  // top — adds a subtle box-shadow so the nav reads as elevated above
  // the page content. RAF-throttled. Threshold of 4px (not 0)
  // because momentum scrolling can leave the page at -1 / +1 pixels
  // briefly and we don't want the shadow to flicker at the top.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let raf: number | null = null;
    const compute = () => {
      raf = null;
      setScrolled((prev) => {
        const next = window.scrollY > 4;
        return prev === next ? prev : next;
      });
    };
    const onScroll = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <header className={`nav${scrolled ? ' nav-scrolled' : ''}`} onMouseLeave={() => setMega(null)}>
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
                  // Capture the trigger element so Esc-from-inside-the-
                  // panel can restore focus here instead of dropping it
                  // to body.
                  //
                  // Phase 227: handle the already-open case explicitly.
                  // The trigger's `onFocus` opens the panel as soon as
                  // the user Tabs onto it, so by the time ArrowDown
                  // fires, `mega` is often ALREADY `item.mega`. In that
                  // case `setMega(item.mega)` is a no-op state update
                  // and React bails out before useLayoutEffect re-runs,
                  // so the deferred first-link focus never happens.
                  // Detect the already-open case and imperatively focus
                  // the first panel link directly. The deferred-focus
                  // path stays for the cold-open case (panel not yet
                  // mounted at keydown time).
                  if (item.mega && (e.key === 'ArrowDown' || e.key === ' ')) {
                    e.preventDefault();
                    megaTriggerRef.current = e.currentTarget;
                    if (mega === item.mega) {
                      megaPanelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
                    } else {
                      pendingKbdFocusRef.current = true;
                      setMega(item.mega);
                    }
                  } else if (e.key === 'Escape') {
                    setMega(null);
                  }
                }}
                aria-expanded={item.mega ? mega === item.mega : undefined}
                aria-haspopup={item.mega ? 'true' : undefined}
                aria-controls={item.mega ? `nav-mega-${item.mega}` : undefined}
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
              {count > 0 ? (
                // aria-hidden — the parent <button> already exposes
                // the count via its dynamic aria-label, so the
                // visible badge is just a visual cue.
                <span className="cart-count" aria-hidden="true">{count}</span>
              ) : null}
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
          // The mega panel is navigation links, not a menu widget. ARIA
          // role="menu" implies arrow-key navigation between menuitems,
          // which doesn't match real-world site nav behavior — and using
          // it without proper menuitem children is incorrect per the
          // WAI-ARIA Authoring Practices Guide. <nav> with aria-label
          // is the right pattern for a navigation submenu; the label
          // surfaces because <nav> has implicit role="navigation".
          <nav
            ref={megaPanelRef}
            id={`nav-mega-${mega}`}
            className="mega"
            onMouseLeave={() => setMega(null)}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return;
              setMega(null);
              // Return focus to the trigger that opened this panel.
              // Read from the ref synchronously, then schedule the
              // .focus() for after the panel unmounts.
              const trigger = megaTriggerRef.current;
              megaTriggerRef.current = null;
              if (trigger) {
                requestAnimationFrame(() => trigger.focus());
              }
            }}
            aria-label={`${mega.charAt(0).toUpperCase() + mega.slice(1)} submenu`}
          >
            <div className="container mega-inner">
              <div className="mega-cols">
                {(mega === 'brands' ? brandCols : MEGA[mega].cols).map((c) => (
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
          </nav>
        ) : null}
      </header>

      {mobileOpen ? (
        <div className="mobile-drawer" role="dialog" aria-label="Site menu" aria-modal="true" ref={mobileDrawerRef}>
          <div className="mobile-drawer-hd">
            <Image
              src="/assets/la-mattress-logo.png"
              alt="LA Mattress"
              className="logo-img"
              width={400}
              height={224}
            />
            <button ref={mobileCloseRef} className="icon-btn" type="button" onClick={closeMobile} aria-label="Close menu">
              <Icon name="close" size={22} />
            </button>
          </div>

          {/* Native GET form → /search?q=… works without JS; closing the
              drawer is cosmetic since the submit navigates away anyway. */}
          <form className="mobile-search" action="/search" role="search" onSubmit={closeMobile}>
            <Icon name="search" size={18} />
            <input
              type="search"
              name="q"
              placeholder="Search mattresses, brands…"
              aria-label="Search"
              enterKeyHint="search"
              autoComplete="off"
            />
          </form>

          <nav className="mobile-list" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              if (!item.mega) {
                return (
                  <Link key={item.label} href={item.href} className="mobile-row" onClick={closeMobile}>
                    <span>{item.label}</span>
                    <Icon name="chevron-right" size={16} />
                  </Link>
                );
              }
              const cols = item.mega === 'brands' ? brandCols : MEGA[item.mega].cols;
              const open = mobileSub === item.label;
              const panelId = `mobile-sub-${item.mega}`;
              return (
                <div key={item.label} className={`mobile-acc${open ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="mobile-row mobile-acc-trigger"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setMobileSub(open ? null : item.label)}
                  >
                    <span>{item.label}</span>
                    <Icon name="chevron-down" size={16} />
                  </button>
                  {open ? (
                    <div className="mobile-acc-panel" id={panelId}>
                      <Link href={item.href} className="mobile-acc-all" onClick={closeMobile}>
                        Browse all {item.label.toLowerCase()} <Icon name="arrow-right" size={14} />
                      </Link>
                      {cols.map((c) => (
                        <div key={c.title} className="mobile-acc-group">
                          <div className="eyebrow mobile-acc-group-title">{c.title}</div>
                          <ul>
                            {c.links.map((l) => (
                              <li key={l.label}>
                                <Link href={l.href} onClick={closeMobile}>{l.label}</Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="mobile-foot">
            <Link href="/account" className="topbar-link" onClick={closeMobile}><Icon name="user" size={14} /> Account</Link>
            <Link href="/pages/mattress-store-locations" className="topbar-link" onClick={closeMobile}><Icon name="pin" size={14} /> Find a store</Link>
            <a href={`tel:${SITE_PHONE_TEL}`} className="topbar-link"><Icon name="phone" size={14} /> Call</a>
          </div>
        </div>
      ) : null}
    </>
  );
}
