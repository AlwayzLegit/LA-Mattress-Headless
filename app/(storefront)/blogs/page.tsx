import type { Metadata } from 'next';
import Link from 'next/link';

import { blogs as inventoryBlogs } from '@/lib/inventory';
import { blogIntroFor } from '@/lib/blog-content';
import { Icon } from '@/app/_components/icon';
import { SITE_URL } from '@/lib/site-config';

/**
 * `/blogs` — the master content hub.
 *
 * The per-blog (`/blogs/[blog]`) and article (`/blogs/[blog]/[article]`)
 * routes already existed, but nothing on the site linked into them and
 * there was no top-level index — every article was reachable only by
 * direct URL or the XML sitemap, which orphans the content for human
 * navigation and starves it of internal link equity.
 *
 * This page fixes that: a curated "Featured guides" block puts the six
 * pillar buyer's-guide articles one click from the hub (and the hub is
 * one click from the footer), then a "Browse by topic" grid links every
 * live editorial blog. Pure static — driven entirely by the committed
 * inventory snapshot, no Shopify fetch — so it renders fast and works
 * even when Shopify env isn't configured.
 *
 * Excludes the thin non-editorial `sales` / `extra-info` blogs.
 *
 * `beds-mattresses` was previously excluded too on the assumption that
 * "every URL under it 301-redirects" — but a SEMrush 20260628 audit
 * showed that's not actually true: of 184 published articles, 162 are
 * 301'd to canonical equivalents (the per-article redirects live in
 * lib/redirects-table.ts) but ~72 still render 200. With the legacy
 * blog hidden from /blogs hub, those 72 articles were live but
 * navigation-orphaned (SEMrush "Page crawl depth" notice flagged them
 * at depth 5-20). Including the blog here makes its index reachable
 * at depth 2; the per-blog A-Z archive section on that index then
 * gives each surviving article a clean depth-3 path. The 162 redirected
 * URLs continue to 301 untouched — they don't appear in the archive
 * because fullArchiveFor filters them out via resolveRedirectPath.
 */
const SITE = SITE_URL; // audit codeq-site-const-dup-10: single source, apex-guarded

const EXCLUDED_BLOG_HANDLES = new Set(['sales', 'extra-info']);

/**
 * Curated featured guides — the pillar cluster, in deliberate reading
 * order (hub first, then the high-intent spokes). Hand-ordered rather
 * than "most recent" because these are the strategic entry points and
 * the order encodes the intended funnel. All live in the
 * `mattress-buying-guide` blog.
 */
const FEATURED: { handle: string; title: string; blurb: string }[] = [
  {
    handle: 'how-to-choose-a-mattress',
    title: 'How to Choose a Mattress',
    blurb: 'The complete buyer’s guide, sleep position, body weight, type, firmness, and budget, in the order that matters.',
  },
  {
    handle: 'best-mattress-for-back-pain',
    title: 'Best Mattress for Back Pain',
    blurb: 'The medium-firm sweet spot, by sleep position and pain type, plus why an adjustable base often helps most.',
  },
  {
    handle: 'how-much-should-you-spend-on-a-mattress',
    title: 'How Much Does a Mattress Cost?',
    blurb: 'Real price ranges by type and size, what you actually get at each tier, and when to buy for the best deal.',
  },
  {
    handle: 'best-mattress-for-side-sleepers',
    title: 'Best Mattress for Side Sleepers',
    blurb: 'Why side sleepers need pressure relief at the shoulders and hips, and the firmness range that delivers it.',
  },
  {
    handle: 'when-to-buy-a-mattress',
    title: 'When Is the Best Time to Buy a Mattress?',
    blurb: 'The sale calendar, Memorial Day, Labor Day, Black Friday, and when waiting actually costs you.',
  },
  {
    handle: 'where-to-buy-a-mattress-in-los-angeles',
    title: 'Where to Buy a Mattress in Los Angeles',
    blurb: 'Local guide: showroom vs. online vs. big-box, neighborhood-by-neighborhood, with same-day white-glove delivery.',
  },
];

const FEATURED_BLOG_HANDLE = 'mattress-buying-guide';

export const metadata: Metadata = {
  title: { absolute: 'Mattress & Sleep Guides · LA Mattress Store' },
  description:
    'Expert mattress buying guides and sleep advice from LA Mattress Store, how to choose a mattress, the best mattress for back pain and side sleepers, pricing, and when to buy. Five LA showrooms.',
  alternates: { canonical: '/blogs' },
  openGraph: {
    type: 'website',
    url: '/blogs',
    title: 'Mattress & Sleep Guides · LA Mattress Store',
    description:
      'Expert mattress buying guides and sleep advice from LA Mattress Store, researched against the brands we actually stock.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
};

export default function BlogsHubPage() {
  const liveBlogs = inventoryBlogs.filter((b) => !EXCLUDED_BLOG_HANDLES.has(b.handle));
  const totalArticles = liveBlogs.reduce((n, b) => n + (b.articles?.length ?? 0), 0);

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE}/blogs` },
    ],
  };

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Mattress & Sleep Guides',
    url: `${SITE}/blogs`,
    inLanguage: 'en-US',
    isPartOf: { '@id': `${SITE}/#website` },
    about: 'Mattress buying guides and sleep advice from LA Mattress Store.',
  };

  return (
    <main>
      <section className="lp-hero">
        <div className="container">
          <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="sep" aria-hidden="true">/</span>
            <span>Guides</span>
          </nav>
          <div className="lp-hero-inner lp-hero-inner-stacked">
            <div className="lp-hero-copy">
              <div className="eyebrow">Mattress &amp; Sleep Guides</div>
              <h1 className="h-display">Guides &amp; advice</h1>
              <p className="lp-hero-lede" style={{ maxWidth: '72ch' }}>
                Buying-guide articles and sleep advice written the way our showroom staff
                would explain it, by sleep position, body weight, temperature, pain points,
                and budget. Researched against the brands we actually stock and tested
                against what real customers tell us after a week on the mattress.
              </p>
              <div className="lp-hero-meta">
                <span><strong>{liveBlogs.length}</strong> topics</span>
                <span><strong>{totalArticles}</strong> articles</span>
                <span><strong>5</strong> LA showrooms</span>
                <span><strong>No</strong> email signup required</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="blogs-featured">
        <div className="container">
          <h2 id="blogs-featured" className="h2">Start here: the buyer&apos;s guide</h2>
          <p className="muted" style={{ maxWidth: '64ch', marginTop: 'var(--s-2)' }}>
            If you&apos;re shopping for a mattress, read these six in order, they cover
            every decision from first question to delivery.
          </p>
          <div className="gd-grid" style={{ marginTop: 'var(--s-5)' }} aria-label="Featured guides">
            {FEATURED.map((f) => (
              <Link
                key={f.handle}
                href={`/blogs/${FEATURED_BLOG_HANDLE}/${f.handle}`}
                className="gd-card"
              >
                <div className="gd-card-body">
                  <div className="gd-card-meta">
                    <span>Buyer&apos;s Guide</span>
                  </div>
                  <h3>{f.title}</h3>
                  <p className="gd-card-excerpt">{f.blurb}</p>
                  <div className="gd-card-foot">
                    <span className="muted">LA Mattress</span>
                    <span className="arrow">
                      Read <Icon name="arrow-right" size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="blogs-topics">
        <div className="container">
          <h2 id="blogs-topics" className="h2">Browse by topic</h2>
          <div className="gd-grid" style={{ marginTop: 'var(--s-5)' }} aria-label="Blog topics">
            {liveBlogs
              .slice()
              .sort((a, b) => (b.articles?.length ?? 0) - (a.articles?.length ?? 0))
              .map((b) => (
                <Link key={b.handle} href={`/blogs/${b.handle}`} className="gd-card">
                  <div className="gd-card-body">
                    <div className="gd-card-meta">
                      <span>{b.articles?.length ?? 0} articles</span>
                    </div>
                    <h3>{b.title.replace(/\s*\|.*$/, '').trim()}</h3>
                    <p className="gd-card-excerpt">{blogIntroFor(b.handle)}</p>
                    <div className="gd-card-foot">
                      <span className="muted">LA Mattress</span>
                      <span className="arrow">
                        Browse <Icon name="arrow-right" size={14} />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </section>

      <script id="ld-breadcrumb-blogs" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script id="ld-blogs-collection" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
    </main>
  );
}
