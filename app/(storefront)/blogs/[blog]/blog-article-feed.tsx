'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { Icon } from '@/app/_components/icon';

/**
 * Serializable shape of one article card. Author name + date label are
 * pre-computed server-side (in the page and in /api/blog-articles) so
 * this client component only ever renders plain strings — no locale
 * date formatting at hydration time, so no server/client drift.
 */
export type ArticleCard = {
  id: string;
  handle: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  imageAlt: string;
  publishedAt: string;
  dateLabel: string;
  authorName: string;
};

/**
 * BlogArticleFeed — the blog index card grid with infinite scroll.
 *
 * The first slice is rendered server-side (passed as `initialArticles`)
 * so the grid is in the SSR HTML for LCP and crawlers. When more pages
 * exist, an IntersectionObserver sentinel fetches the next slice from
 * /api/blog-articles and *appends* it — no page navigation, no reset of
 * the cards already on screen (the old `?after=` <Link> did both). A
 * real "Load more" button is also rendered as a progressive-enhancement
 * fallback (keyboard users, reduced-motion, or if the observer never
 * fires) and drives the exact same loader.
 */
export function BlogArticleFeed({
  blogHandle,
  blogTitle,
  initialArticles,
  initialCursor,
}: {
  blogHandle: string;
  blogTitle: string;
  initialArticles: ArticleCard[];
  initialCursor: string | null;
}) {
  const [articles, setArticles] = useState<ArticleCard[]>(initialArticles);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Guards against a stale in-flight request appending twice for the
  // same cursor (observer + button both firing).
  const loadingCursor = useRef<string | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading || loadingCursor.current === cursor) return;
    loadingCursor.current = cursor;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `/api/blog-articles?blog=${encodeURIComponent(blogHandle)}&after=${encodeURIComponent(cursor)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { articles: ArticleCard[]; nextCursor: string | null } = await res.json();
      setArticles((prev) => {
        // De-dupe by id in case a cursor boundary overlaps.
        const seen = new Set(prev.map((a) => a.id));
        return [...prev, ...data.articles.filter((a) => !seen.has(a.id))];
      });
      setCursor(data.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      loadingCursor.current = null;
    }
  }, [blogHandle, cursor, loading]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      // Start fetching a little before the sentinel is on screen so the
      // grid stays ahead of the scroll.
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  return (
    <>
      <div className="gd-grid" aria-label="Articles">
        {articles.map((a, idx) => (
          <Link key={a.id} href={`/blogs/${blogHandle}/${a.handle}`} className="gd-card">
            <div className="gd-card-img">
              {a.imageUrl ? (
                <Image
                  src={a.imageUrl}
                  alt={a.imageAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  style={{ objectFit: 'cover' }}
                  priority={idx < 3}
                />
              ) : (
                <span
                  className="ph-label"
                  style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}
                >
                  [Article image]
                </span>
              )}
            </div>
            <div className="gd-card-body">
              <div className="gd-card-meta">
                <span>{blogTitle}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={a.publishedAt}>{a.dateLabel}</time>
              </div>
              <h3>{a.title}</h3>
              {a.excerpt ? <p className="gd-card-excerpt">{a.excerpt}</p> : null}
              <div className="gd-card-foot">
                <span className="muted">By {a.authorName}</span>
                <span className="arrow">
                  Read <Icon name="arrow-right" size={14} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Live region announces appended pages to assistive tech. */}
      <p aria-live="polite" className="sr-only">
        {loading ? 'Loading more articles' : ''}
      </p>

      {cursor ? (
        <div className="plp-pagination" style={{ marginTop: 'var(--s-7)' }}>
          <div ref={sentinelRef} aria-hidden="true" />
          <button
            type="button"
            className="btn btn-ghost btn-lg"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? 'Loading…' : error ? 'Retry' : 'Load more'}{' '}
            <Icon name="arrow-right" size={16} />
          </button>
        </div>
      ) : null}
    </>
  );
}
