import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';

import { getPageByHandle } from '@/lib/shopify';
import { publishedPages } from '@/lib/inventory';

type Params = { params: { handle: string } };

export const revalidate = 600;
export const dynamicParams = true;

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);

export function generateStaticParams() {
  if (!SHOPIFY_CONFIGURED) return [];
  return publishedPages.map((p) => ({ handle: p.handle }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!SHOPIFY_CONFIGURED) return { title: 'Page' };
  const page = await getPageByHandle(params.handle).catch(() => null);
  if (!page) return { title: 'Page not found' };
  const title = page.seo.title ?? page.title;
  const description =
    page.seo.description ??
    (page.bodySummary?.length ? page.bodySummary.slice(0, 160) : `${page.title} — LA Mattress Store`);
  const url = `/pages/${page.handle}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', url, title, description },
  };
}

const isLocationPage = (handle: string) =>
  handle.includes('koreatown') ||
  handle.includes('best-mattress-store') ||
  handle.includes('mattress-store-studio-city') ||
  handle.includes('mattress-store-in-glendale') ||
  handle.includes('mattress-store-locations');

export default async function ShopifyPage({ params }: Params) {
  if (!SHOPIFY_CONFIGURED) notFound();
  const page = await getPageByHandle(params.handle).catch(() => null);
  if (!page) notFound();

  const localBusinessLd = isLocationPage(page.handle)
    ? {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: 'LA Mattress Store',
        url: `https://mattressstoreslosangeles.com/pages/${page.handle}`,
        telephone: '+1-213-555-0142',
        priceRange: '$$$',
      }
    : null;

  return (
    <main className="container">
      <article className="cms-page" style={{ padding: 'var(--s-8) 0' }}>
        <nav className="lp-breadcrumbs">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <span>{page.title}</span>
        </nav>
        <h1 className="h1" style={{ marginTop: 'var(--s-4)' }}>{page.title}</h1>
        {page.body ? (
          <div className="rte cms-body" dangerouslySetInnerHTML={{ __html: page.body }} />
        ) : (
          <p className="muted">This page has no content yet.</p>
        )}
      </article>

      {localBusinessLd ? (
        <Script id="ld-localbusiness-page" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessLd) }} />
      ) : null}
    </main>
  );
}
