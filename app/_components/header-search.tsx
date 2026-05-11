'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './icon';
import { useBodyScrollLock } from './use-body-scroll-lock';
import { useFocusTrap } from './use-focus-trap';
import { announce } from './announcer';
import type { Predictive } from '@/lib/shopify';
import { formatMoney } from '@/lib/format';
import { searchShowrooms, type Showroom } from '@/lib/showrooms';

/**
 * Curated trending pills shown above-the-fold in the empty search panel
 * (design handoff §search-overlay · Trending). The list is hand-picked
 * by merchandising — analytics-driven trending is a separate workstream.
 * Each entry submits as a real query; the matching results page is what
 * the visitor lands on.
 */
const TRENDING: string[] = [
  'Tempur-Pedic',
  'Queen mattress',
  'Cooling',
  'Adjustable bed',
  'Memory foam',
  'Hybrid',
  'Stearns & Foster',
  'On sale',
];

const RECENT_KEY = 'la-mattress.recent-search.v1';
const RECENT_MAX = 5;

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((s): s is string => typeof s === 'string').slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function writeRecent(items: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, RECENT_MAX)));
  } catch {
    // ignore quota / private mode
  }
}

function pushRecent(query: string): string[] {
  const q = query.trim();
  if (!q) return readRecent();
  const cur = readRecent().filter((s) => s.toLowerCase() !== q.toLowerCase());
  const next = [q, ...cur].slice(0, RECENT_MAX);
  writeRecent(next);
  return next;
}

/**
 * Header search overlay (design handoff §search-overlay).
 *
 * Click the search icon (or hit `/` from a non-input or Cmd+K from
 * anywhere) to open a full-screen modal. The modal contains:
 *
 *   .search-overlay        backdrop (fixed inset 0, click to close)
 *     .search-panel        centered card (max-w 720)
 *       .search-head       icon + input + Esc kbd
 *       .search-body       pre-query state (Trending / Recent /
 *                          Quick links) OR result groups
 *       .search-foot       keyboard hints (↑↓ navigate · ↵ select ·
 *                          esc close · LA Mattress brand mark)
 *
 * Body scroll is locked while the overlay is open. Render is gated
 * behind a `mounted` flag so the createPortal call doesn't run during
 * SSR (document is undefined there).
 */
export function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Predictive | null>(null);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);
  const listboxId = useId();

  // Tab cycles within the open overlay; close restores focus to the
  // trigger button (search icon) so keyboard users don't dump back to
  // document.body.
  useFocusTrap(open, panelRef);

  // Portal needs document; flag it after hydration.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Hydrate recent searches once when the panel first opens. Reading
  // localStorage on mount would run on every page that includes the nav,
  // so we defer it until the user actually engages with search.
  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
  }, [open]);

  // Stack-aware body scroll lock — see use-body-scroll-lock.ts. Other
  // overlays (cart drawer, filter shell, mobile nav) share the hook so
  // concurrent modals don't strand body in overflow:hidden.
  useBodyScrollLock(open);

  // Auto-focus the input on open. Wait one frame so the portal has
  // mounted and the input ref is wired.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Debounced predictive fetch on query change.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    const myId = ++reqIdRef.current;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/predictive-search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Predictive;
        if (reqIdRef.current === myId) {
          setResults(data);
          setHighlight(-1);
          // Announce result count for SR users so the listbox transition
          // isn't silent. Showroom matches are searched client-side and
          // counted alongside Shopify results. Fires once per debounced
          // request (180ms after typing stops), not per keystroke.
          const showroomCount = searchShowrooms(q).length;
          const total =
            data.products.length +
            data.collections.length +
            data.articles.length +
            data.pages.length +
            showroomCount;
          announce(
            total === 0
              ? `No matches for ${q}. Press Enter to search anyway.`
              : `${total} suggestion${total === 1 ? '' : 's'} for ${q}`,
          );
        }
      } catch {
        if (reqIdRef.current === myId) setResults(null);
      } finally {
        if (reqIdRef.current === myId) setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(t);
  }, [query, open]);

  // Reset query when the overlay closes so a re-open starts from the
  // empty state (Trending / Recent / Quick links) rather than the last
  // query's results.
  useEffect(() => {
    if (open) return;
    setQuery('');
    setResults(null);
    setHighlight(-1);
  }, [open]);

  // Keyboard shortcuts to open + focus the header search:
  //   "/"      — GitHub-style. Ignored when typing in an input/textarea
  //              so it doesn't hijack regular typing.
  //   Cmd+K    — Mac (also Ctrl+K on Windows/Linux). Spotlight/Command-
  //              palette pattern from the design's search overlay; works
  //              even when an input is focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK =
        e.key.toLowerCase() === 'k' &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey;

      if (isCmdK) {
        e.preventDefault();
        setOpen(true);
        return;
      }

      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName ?? '').toLowerCase();
      const editable = tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable);
      if (editable) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Showrooms catalog is 5 entries — filter client-side, no API call.
  const showroomMatches = query.trim().length >= 2 ? searchShowrooms(query) : [];

  // Esc to close, ↑/↓ to navigate suggestions, Enter to commit highlight.
  const flat = flatten(results, showroomMatches);
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!flat.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? flat.length - 1 : h - 1));
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault();
      const item = flat[highlight];
      if (item) {
        setOpen(false);
        router.push(item.href);
      }
    }
  };

  const goToSearch = useCallback(
    (term: string) => {
      const q = term.trim();
      if (!q) return;
      setRecent(pushRecent(q));
      setOpen(false);
      router.push(`/search?${new URLSearchParams({ q }).toString()}`);
    },
    [router],
  );

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    goToSearch(query);
  };

  // Trigger button always renders. The overlay is mounted into a
  // portal when `open` flips true.
  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-label="Search (press / to focus)"
        title="Search ( / )"
        onClick={() => setOpen(true)}
      >
        <Icon name="search" size={18} />
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="search-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Search"
              onClick={(e) => {
                // Backdrop click closes; clicks inside the panel
                // bubble to here too, but only the backdrop element
                // itself should close.
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div className="search-panel" ref={panelRef}>
                <form className="search-head" onSubmit={submit} role="search">
                  <span className="search-icon" aria-hidden="true">
                    <Icon name="search" size={18} />
                  </span>
                  <input
                    ref={inputRef}
                    type="search"
                    autoComplete="off"
                    placeholder="Search mattresses, brands, showrooms…"
                    value={query}
                    onChange={(e) => setQuery(e.currentTarget.value)}
                    onKeyDown={onKeyDown}
                    className="search-input"
                    aria-label="Search products"
                    aria-autocomplete="list"
                    aria-controls={listboxId}
                    aria-activedescendant={highlight >= 0 ? `${listboxId}-${highlight}` : undefined}
                  />
                  <kbd className="search-kbd search-kbd-hint" aria-hidden="true">esc</kbd>
                  <button
                    type="button"
                    className="search-close"
                    onClick={() => setOpen(false)}
                    aria-label="Close search"
                  >
                    <Icon name="close" size={18} />
                  </button>
                </form>

                <div
                  className="search-body"
                  role="listbox"
                  id={listboxId}
                  aria-busy={loading || undefined}
                >
                  {query.trim().length < 2 ? (
                    <div className="search-prequery">
                      <div className="search-section">
                        <div className="search-section-label">Trending</div>
                        <div className="search-trending">
                          {TRENDING.map((t) => (
                            <button
                              key={t}
                              type="button"
                              className="search-trending-pill"
                              onClick={() => goToSearch(t)}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {recent.length > 0 ? (
                        <div className="search-section">
                          <div className="search-section-label">Recent</div>
                          <ul className="search-recent">
                            {recent.map((r) => (
                              <li key={r}>
                                <button
                                  type="button"
                                  className="search-recent-row"
                                  onClick={() => goToSearch(r)}
                                >
                                  <span className="search-recent-icon" aria-hidden="true">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="9" />
                                      <path d="M12 7v5l3 2" />
                                    </svg>
                                  </span>
                                  <span>{r}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="search-section">
                        <div className="search-section-label">Quick links</div>
                        <div className="search-quick-grid">
                          {[
                            { label: 'Take the sleep quiz', href: '/sleep-quiz', body: '8 questions, 2 minutes' },
                            { label: 'Compare mattresses',  href: '/compare',    body: 'Side-by-side specs' },
                            { label: 'Find a showroom',     href: '/pages/mattress-store-locations', body: '5 across LA' },
                            { label: 'Browse on sale',      href: '/collections/on-sale',            body: 'Current markdowns' },
                          ].map((q) => (
                            <Link
                              key={q.label}
                              href={q.href}
                              className="search-quick"
                              onClick={() => setOpen(false)}
                            >
                              <div className="search-quick-label">{q.label}</div>
                              <div className="search-quick-body muted">{q.body}</div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : loading && flat.length === 0 ? (
                    <div className="search-empty-msg">Searching…</div>
                  ) : flat.length === 0 ? (
                    <div className="search-empty-msg">
                      No matches. Press Enter to search anyway.
                    </div>
                  ) : (
                    <>
                      {results && results.products.length > 0 ? (
                        <div className="header-search-group">
                          <div className="eyebrow header-search-group-label">Products</div>
                          <ul>
                            {results.products.slice(0, 6).map((p, i) => {
                              const idx = i;
                              return (
                                <li key={p.id}>
                                  <Link
                                    href={`/products/${p.handle}`}
                                    className={`header-search-result${highlight === idx ? ' is-highlighted' : ''}`}
                                    id={`${listboxId}-${idx}`}
                                    role="option"
                                    aria-selected={highlight === idx}
                                    onClick={() => setOpen(false)}
                                  >
                                    <div className="header-search-thumb">
                                      {p.featuredImage ? (
                                        <Image
                                          src={p.featuredImage.url}
                                          alt={p.featuredImage.altText ?? p.title}
                                          width={48}
                                          height={48}
                                          sizes="48px"
                                          style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                                        />
                                      ) : null}
                                    </div>
                                    <div className="header-search-meta">
                                      <div className="header-search-vendor">{p.vendor}</div>
                                      <div className="header-search-title">{p.title}</div>
                                    </div>
                                    <div className="header-search-price tnum">
                                      {formatMoney(p.priceRange.minVariantPrice)}
                                    </div>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}
                      {results && results.collections.length > 0 ? (
                        <div className="header-search-group">
                          <div className="eyebrow header-search-group-label">Collections</div>
                          <ul>
                            {results.collections.slice(0, 4).map((c, i) => {
                              const idx = Math.min(results.products.length, 6) + i;
                              return (
                                <li key={c.handle}>
                                  <Link
                                    href={`/collections/${c.handle}`}
                                    className={`header-search-link${highlight === idx ? ' is-highlighted' : ''}`}
                                    id={`${listboxId}-${idx}`}
                                    role="option"
                                    aria-selected={highlight === idx}
                                    onClick={() => setOpen(false)}
                                  >
                                    {c.title}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}
                      {showroomMatches.length > 0 ? (
                        <div className="header-search-group">
                          <div className="eyebrow header-search-group-label">Showrooms</div>
                          <ul>
                            {showroomMatches.slice(0, 4).map((s, i) => {
                              const productCount = Math.min(results?.products.length ?? 0, 6);
                              const collectionCount = Math.min(results?.collections.length ?? 0, 4);
                              const idx = productCount + collectionCount + i;
                              return (
                                <li key={s.handle}>
                                  <Link
                                    href={`/pages/${s.handle}`}
                                    className={`header-search-link header-search-article${highlight === idx ? ' is-highlighted' : ''}`}
                                    id={`${listboxId}-${idx}`}
                                    role="option"
                                    aria-selected={highlight === idx}
                                    onClick={() => setOpen(false)}
                                  >
                                    <span className="header-search-article-title">{s.name}</span>
                                    <span className="muted header-search-article-blog">{s.area}</span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}
                      {results && results.articles.length > 0 ? (
                        <div className="header-search-group">
                          <div className="eyebrow header-search-group-label">Articles</div>
                          <ul>
                            {results.articles.slice(0, 4).map((a, i) => {
                              const idx =
                                Math.min(results.products.length, 6) +
                                Math.min(results.collections.length, 4) +
                                Math.min(showroomMatches.length, 4) +
                                i;
                              return (
                                <li key={a.id}>
                                  <Link
                                    href={`/blogs/${a.blog.handle}/${a.handle}`}
                                    className={`header-search-link header-search-article${highlight === idx ? ' is-highlighted' : ''}`}
                                    id={`${listboxId}-${idx}`}
                                    role="option"
                                    aria-selected={highlight === idx}
                                    onClick={() => setOpen(false)}
                                  >
                                    <span className="header-search-article-title">{a.title}</span>
                                    <span className="muted header-search-article-blog">{a.blog.title}</span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                <footer className="search-foot">
                  <span className="search-foot-item"><kbd className="search-kbd">↑</kbd><kbd className="search-kbd">↓</kbd> navigate</span>
                  <span className="search-foot-item"><kbd className="search-kbd">↵</kbd> select</span>
                  <span className="search-foot-item"><kbd className="search-kbd">esc</kbd> close</span>
                  <span className="search-foot-spacer" />
                  <span className="search-foot-brand">LA Mattress</span>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

type Flat = { href: string };

function flatten(r: Predictive | null, showrooms: Showroom[] = []): Flat[] {
  const out: Flat[] = [];
  if (r) {
    for (const p of r.products.slice(0, 6)) out.push({ href: `/products/${p.handle}` });
    for (const c of r.collections.slice(0, 4)) out.push({ href: `/collections/${c.handle}` });
  }
  for (const s of showrooms.slice(0, 4)) out.push({ href: `/pages/${s.handle}` });
  if (r) {
    for (const a of r.articles.slice(0, 4)) out.push({ href: `/blogs/${a.blog.handle}/${a.handle}` });
  }
  return out;
}
