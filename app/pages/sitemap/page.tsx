import type { Metadata } from 'next';
import Link from 'next/link';
import {
  blogs as inventoryBlogs,
  nonEmptyCollections,
  publishedPages,
  products as inventoryProducts,
} from '@/lib/inventory';

/**
 * HTML sitemap — every collection, every blog (with every article in it),
 * every published page, every product handle. One linked-from-the-footer
 * page that exposes the full reachable URL graph.
 *
 * Why this exists (Phase 282): the May 14 SEMrush re-audit flagged 984
 * sitemap URLs as "Orphaned sitemap pages" — including obviously-linked
 * ones like /collections/mattresses and /pages/about. The cause is
 * SEMrush's crawler not traversing pagination on PLPs and blog indexes
 * deeply enough to discover every entry that lives in /sitemap.xml.
 *
 * The standard fix at every large ecommerce site is an HTML sitemap
 * page (Wayfair, REI, Amazon all have one). It collects every URL in
 * the catalog into flat <ul> link lists so crawlers can find them all
 * from one landing page without paginating. Footer link in
 * components/footer.tsx points at this page.
 *
 * The sitemap.xml route still exists at /sitemap.xml and remains the
 * canonical machine-readable sitemap; this HTML page is for crawl
 * traversal + the rare human who wants an index.
 *
 * Skipping deprecated `beds-mattresses` blog (same filter as sitemap.ts).
 */
const SITE = 'https://www.mattressstoreslosangeles.com';

const DEPRECATED_BLOG_HANDLES = new Set(['beds-mattresses']);

export const metadata: Metadata = {
  title: { absolute: 'Sitemap · LA Mattress Store' },
  description:
    'Full directory of every page, mattress collection, brand, blog article, and policy at LA Mattress Store — five LA showrooms, premium mattresses, white-glove delivery.',
  alternates: { canonical: '/pages/sitemap' },
  robots: { index: true, follow: true },
};

export default function HtmlSitemapPage() {
  const liveBlogs = inventoryBlogs.filter((b) => !DEPRECATED_BLOG_HANDLES.has(b.handle));
  const totalArticles = liveBlogs.reduce((n, b) => n + (b.articles?.length ?? 0), 0);

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Sitemap', item: `${SITE}/pages/sitemap` },
    ],
  };

  return (
    <main className="container html-sitemap">
      <nav className="lp-breadcrumbs" aria-label="Breadcrumb" style={{ paddingTop: 'var(--s-5)' }}>
        <Link href="/">Home</Link>
        <span className="sep" aria-hidden="true">/</span>
        <span>Sitemap</span>
      </nav>

      <header className="html-sitemap-head">
        <h1 className="h1">Sitemap</h1>
        <p className="muted html-sitemap-lede">
          The full directory of pages, collections, brands, blog articles, and policies on
          mattressstoreslosangeles.com. {nonEmptyCollections.length} collections,{' '}
          {publishedPages.length} pages, {liveBlogs.length} blogs with {totalArticles}{' '}
          articles, and {inventoryProducts.length} mattresses. Five Los Angeles showrooms —
          Koreatown, West LA, La Brea, Studio City, Glendale.
        </p>
      </header>

      <section className="html-sitemap-section" aria-labelledby="hs-shop">
        <h2 id="hs-shop" className="h2">Shop</h2>
        <ul className="html-sitemap-list">
          {nonEmptyCollections
            .slice()
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((c) => (
              <li key={c.handle}>
                <Link href={`/collections/${c.handle}`}>{c.title}</Link>
              </li>
            ))}
        </ul>
      </section>

      <section className="html-sitemap-section" aria-labelledby="hs-pages">
        <h2 id="hs-pages" className="h2">Pages &amp; policies</h2>
        <ul className="html-sitemap-list">
          {publishedPages
            .slice()
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((p) => (
              <li key={p.handle}>
                <Link href={`/pages/${p.handle}`}>{p.title}</Link>
              </li>
            ))}
        </ul>
      </section>

      <section className="html-sitemap-section" aria-labelledby="hs-quiz">
        <h2 id="hs-quiz" className="h2">Tools &amp; utilities</h2>
        <ul className="html-sitemap-list">
          <li><Link href="/sleep-quiz">Sleep Quiz — 2-minute mattress match</Link></li>
          <li><Link href="/compare">Compare mattresses</Link></li>
          <li><Link href="/wishlist">Wishlist</Link></li>
          <li><Link href="/search">Search</Link></li>
        </ul>
      </section>

      {liveBlogs.map((blog) => (
        <section key={blog.handle} className="html-sitemap-section" aria-labelledby={`hs-blog-${blog.handle}`}>
          <h2 id={`hs-blog-${blog.handle}`} className="h2">
            <Link href={`/blogs/${blog.handle}`}>{blog.title}</Link>
            <span className="muted html-sitemap-count">
              · {blog.articles?.length ?? 0} articles
            </span>
          </h2>
          {blog.articles && blog.articles.length > 0 ? (
            <ul className="html-sitemap-list">
              {blog.articles
                .slice()
                .sort((a, b) => (a.title ?? a.handle).localeCompare(b.title ?? b.handle))
                .map((a) => (
                  <li key={a.handle}>
                    <Link href={`/blogs/${blog.handle}/${a.handle}`}>
                      {a.title ?? a.handle}
                    </Link>
                  </li>
                ))}
            </ul>
          ) : null}
        </section>
      ))}

      <section className="html-sitemap-section" aria-labelledby="hs-products">
        <h2 id="hs-products" className="h2">
          Mattresses
          <span className="muted html-sitemap-count">
            · {inventoryProducts.length} products
          </span>
        </h2>
        <ul className="html-sitemap-list">
          {inventoryProducts
            .slice()
            .sort((a, b) => a.handle.localeCompare(b.handle))
            .map((p) => (
              <li key={p.handle}>
                <Link href={`/products/${p.handle}`}>
                  {p.handle
                    .split('-')
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ')}
                </Link>
              </li>
            ))}
        </ul>
      </section>

      <script
        id="ld-breadcrumb-sitemap"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
    </main>
  );
}
