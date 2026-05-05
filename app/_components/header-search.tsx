'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './icon';
import type { Predictive } from '@/lib/shopify';
import { formatMoney } from '@/lib/format';

/**
 * Click-to-expand header search with debounced predictive autocomplete.
 *
 * Calls /api/predictive-search server endpoint (which proxies to Storefront
 * predictiveSearch) so the public token doesn't leak into the client bundle.
 * Renders a panel below the input with up to 8 product matches plus
 * collections + pages. Esc / outside-click / blur close the panel.
 *
 * Submission falls through to /search?q={query} for the full results page.
 */
export function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Predictive | null>(null);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);
  const listboxId = useId();

  // Debounced fetch on query change.
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
        }
      } catch {
        if (reqIdRef.current === myId) setResults(null);
      } finally {
        if (reqIdRef.current === myId) setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(t);
  }, [query, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (inputRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Global "/" shortcut to open + focus the header search, like GitHub does.
  // Ignored when the user is already typing in another input/textarea/select
  // or in an editable area, so it doesn't hijack regular typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName ?? '').toLowerCase();
      const editable = tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable);
      if (editable) return;
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Esc to close, ↑/↓ to navigate suggestions, Enter to commit highlight.
  const flat = flatten(results);
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
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

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/search?${new URLSearchParams({ q }).toString()}`);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="icon-btn"
        aria-label="Search (press / to focus)"
        title="Search (/)"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <Icon name="search" size={18} />
      </button>
    );
  }

  return (
    <div className="header-search">
      <form className="header-search-form" onSubmit={submit} role="search">
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          type="search"
          autoComplete="off"
          placeholder="Search mattresses, brands, sizes…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          aria-label="Search products"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={highlight >= 0 ? `${listboxId}-${highlight}` : undefined}
        />
        <button
          type="button"
          className="icon-btn"
          aria-label="Close search"
          onClick={() => setOpen(false)}
        >
          <Icon name="close" size={18} />
        </button>
      </form>
      {query.trim().length >= 2 ? (
        <div ref={panelRef} className="header-search-panel" role="listbox" id={listboxId}>
          {loading ? (
            <div className="header-search-empty">Searching…</div>
          ) : !results || flat.length === 0 ? (
            <div className="header-search-empty">No matches. Press Enter to search anyway.</div>
          ) : (
            <>
              {results.products.length > 0 ? (
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
              {results.collections.length > 0 ? (
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
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

type Flat = { href: string };

function flatten(r: Predictive | null): Flat[] {
  if (!r) return [];
  const out: Flat[] = [];
  for (const p of r.products.slice(0, 6)) out.push({ href: `/products/${p.handle}` });
  for (const c of r.collections.slice(0, 4)) out.push({ href: `/collections/${c.handle}` });
  return out;
}
