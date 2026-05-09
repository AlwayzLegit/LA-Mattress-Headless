import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { getProductByHandle } from '@/lib/shopify';
import type { Product } from '@/lib/shopify';
import { formatPriceRange } from '@/lib/format';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';
import { Icon } from '@/app/_components/icon';
import { CompareRemove } from './compare-remove';
import { CompareTrayHint } from './compare-tray-hint';

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);
const MAX = 4;
const SIZE_ORDER = ['Twin', 'Twin XL', 'Full', 'Full XL', 'Queen', 'King', 'California King', 'Cal King', 'Split King', 'Split Cal King', 'Split California King'];

export const metadata: Metadata = {
  title: 'Compare mattresses',
  description: 'Side-by-side comparison of mattresses you’re considering.',
  robots: { index: false, follow: false },
};

type Search = { searchParams: Promise<{ ids?: string }> };

export default async function ComparePage({ searchParams }: Search) {
  const sp = await searchParams;
  const handles = (sp.ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX);

  const products = SHOPIFY_CONFIGURED
    ? (await Promise.all(handles.map((h) => getProductByHandle(h).catch(() => null))))
        .filter((p): p is Product => p !== null)
    : [];

  return (
    <main className="container compare-page">
      <nav className="lp-breadcrumbs" aria-label="Breadcrumb" style={{ paddingTop: 'var(--s-5)' }}>
        <Link href="/">Home</Link>
        <span className="sep" aria-hidden="true">/</span>
        <span>Compare</span>
      </nav>

      <header className="compare-header">
        <div className="eyebrow">Side-by-side</div>
        <h1 className="h1">Compare mattresses</h1>
        <p className="muted compare-lede">
          {products.length === 0
            ? 'Pick mattresses from any collection page using the "Compare" button — up to 4 — then come back to this page.'
            : products.length === 1
              ? 'Add at least one more mattress to see them side by side.'
              : `Comparing ${products.length} mattress${products.length === 1 ? '' : 'es'}.`}
        </p>
      </header>

      {products.length === 0 ? (
        <div className="compare-empty-cta">
          <CompareTrayHint />
          <Link href="/collections/mattresses" className="btn btn-primary btn-lg">
            Browse mattresses <Icon name="arrow-right" size={14} />
          </Link>
        </div>
      ) : (
        <div className="compare-table-wrap" role="region" aria-label="Comparison table" tabIndex={0}>
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col" className="compare-row-label">&nbsp;</th>
                {products.map((p) => (
                  <th key={p.id} scope="col" className="compare-product-cell">
                    <div className="compare-product-img" style={{ position: 'relative' }}>
                      {p.featuredImage ? (
                        <Image
                          src={p.featuredImage.url}
                          alt={p.featuredImage.altText ?? p.title}
                          fill
                          sizes="(max-width: 640px) 50vw, 200px"
                          style={{ objectFit: 'contain' }}
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="compare-product-vendor">{p.vendor}</div>
                    <Link href={`/products/${p.handle}`} className="compare-product-name">
                      {p.title}
                    </Link>
                    <CompareRemove handle={p.handle} title={p.title} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <SpecRow label="Price">
                {products.map((p) => (
                  <td key={p.id} className="tnum">
                    {formatPriceRange(p.priceRange.minVariantPrice, p.priceRange.maxVariantPrice)}
                  </td>
                ))}
              </SpecRow>
              <SpecRow label="Brand">
                {products.map((p) => <td key={p.id}>{p.vendor || '—'}</td>)}
              </SpecRow>
              <SpecRow label="Material">
                {products.map((p) => <td key={p.id}>{p.specs.materialType || p.productType || '—'}</td>)}
              </SpecRow>
              <SpecRow label="Firmness">
                {products.map((p) => <td key={p.id}>{p.specs.firmness || '—'}</td>)}
              </SpecRow>
              <SpecRow label="Height">
                {products.map((p) => (
                  <td key={p.id}>{p.specs.heightInches !== null ? `${p.specs.heightInches}"` : '—'}</td>
                ))}
              </SpecRow>
              <SpecRow label="Sizes">
                {products.map((p) => {
                  const opt = p.options.find((o) => /size/i.test(o.name));
                  if (!opt) return <td key={p.id}>—</td>;
                  // Sort sizes in canonical mattress order so the row reads as
                  // parallel across products (otherwise products list sizes in
                  // whatever order they were added in Shopify Admin).
                  const ordered = [...opt.values].sort((a, b) => {
                    const ai = SIZE_ORDER.indexOf(a);
                    const bi = SIZE_ORDER.indexOf(b);
                    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                  });
                  return <td key={p.id}>{ordered.join(', ')}</td>;
                })}
              </SpecRow>
              <SpecRow label="Comfort trial">
                {products.map((p) => (
                  <td key={p.id}>{p.specs.trialNights !== null ? `${p.specs.trialNights} nights` : '—'}</td>
                ))}
              </SpecRow>
              <SpecRow label="Warranty">
                {products.map((p) => (
                  <td key={p.id}>{p.specs.warrantyYears !== null ? `${p.specs.warrantyYears} years` : '—'}</td>
                ))}
              </SpecRow>
              <SpecRow label="Available">
                {products.map((p) => (
                  <td key={p.id}>{p.availableForSale ? 'In stock' : 'Currently out of stock'}</td>
                ))}
              </SpecRow>
              <SpecRow label="Reviews">
                {products.map((p) => (
                  <td key={p.id}>
                    {p.reviews
                      ? `${p.reviews.rating.toFixed(1)} / 5 · ${p.reviews.count.toLocaleString()} review${p.reviews.count === 1 ? '' : 's'}`
                      : '—'}
                  </td>
                ))}
              </SpecRow>
              <tr>
                <th scope="row" className="compare-row-label">&nbsp;</th>
                {products.map((p) => (
                  <td key={p.id}>
                    <Link href={`/products/${p.handle}`} className="btn btn-primary">
                      View product <Icon name="arrow-right" size={14} />
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {products.length > 0 ? (
        <p className="muted compare-fineprint">
          A &ldquo;—&rdquo; means that detail isn&rsquo;t published for that mattress yet.
          Call us at <a href={`tel:${SITE_PHONE_TEL}`}>{SITE_PHONE_DISPLAY}</a> or stop by a
          showroom and we&rsquo;ll walk you through the differences in person.
        </p>
      ) : null}
    </main>
  );
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" className="compare-row-label">{label}</th>
      {children}
    </tr>
  );
}
