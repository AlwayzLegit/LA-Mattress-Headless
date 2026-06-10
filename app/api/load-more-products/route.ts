import { NextResponse } from 'next/server';
import { getCollectionByHandle } from '@/lib/shopify';
import { parseSort } from '@/app/(storefront)/collections/[handle]/sort-options';
import {
  parseFilterSelection,
  selectionToProductFilters,
} from '@/app/_components/plp-filters/filters';

export const runtime = 'edge';

const PER_PAGE = 24;

/**
 * Server-side proxy for "load more products" on the collection PLP.
 *
 * Phase 216 addition. The PLP's load-more was previously a `<Link>` to
 * the same route with a different `?after=` cursor, which caused a
 * full page navigation + re-fetch + skeleton flash + scroll-jump.
 * Phase 217's `PlpInfiniteScroll` client component calls this route
 * with the next cursor and appends the returned products in place.
 *
 * Query params (all mirror the PLP page's `searchParams` shape):
 *   handle          — required collection handle
 *   after           — required Shopify cursor for the next page
 *   sort            — optional, same value the PLP page uses (e.g.
 *                     "PRICE-r", "BEST_SELLING")
 *   vendor / type / size / firmness / sleepPosition / heightRange
 *                   — optional comma-separated filter values
 *   price           — optional "min-max" / "min-" / "-max" range
 *
 * Response shape:
 *   { products: ProductSummary[], pageInfo: { hasNextPage, endCursor } }
 *
 * Returns 400 on missing handle or after — these are required for a
 * load-more call.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = searchParams.get('handle');
  const after = searchParams.get('after');

  if (!handle || !after) {
    return NextResponse.json(
      { products: [], pageInfo: { hasNextPage: false, endCursor: null } },
      { status: 400 },
    );
  }

  // Convert searchParams to the plain Record shape the existing PLP
  // helpers expect. They were built for a server-component
  // `searchParams` object; we mirror the same shape here so the parsing
  // logic is byte-identical to what the PLP page does on initial render.
  const flatParams: Record<string, string | undefined> = {
    sort: searchParams.get('sort') ?? undefined,
    vendor: searchParams.get('vendor') ?? undefined,
    type: searchParams.get('type') ?? undefined,
    size: searchParams.get('size') ?? undefined,
    price: searchParams.get('price') ?? undefined,
    firmness: searchParams.get('firmness') ?? undefined,
    sleepPosition: searchParams.get('sleepPosition') ?? undefined,
    heightRange: searchParams.get('heightRange') ?? undefined,
  };

  const { sortKey, reverse } = parseSort(flatParams.sort);
  const filterSel = parseFilterSelection(flatParams);
  const filters = selectionToProductFilters(filterSel);

  try {
    const collection = await getCollectionByHandle({
      handle,
      first: PER_PAGE,
      after,
      sortKey,
      reverse,
      filters,
    });
    if (!collection) {
      return NextResponse.json(
        { products: [], pageInfo: { hasNextPage: false, endCursor: null } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        products: collection.products.nodes,
        pageInfo: collection.products.pageInfo,
      },
      {
        // Same cursor + same filter + same sort = same page. Cache
        // briefly so a back/forward navigation that re-triggers the
        // same load-more call hits the edge instead of re-querying
        // Storefront. Short SWR so genuine inventory changes
        // (out-of-stock toggles, new products) propagate quickly.
        headers: {
          'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch {
    // Upstream (Storefront API) failure. Surface it as a 503 instead of
    // a 200-with-empty-page: the client treats !res.ok as an error and
    // shows its retry affordance, whereas an empty 200 reads as "no more
    // products" and silently ends pagination mid-outage. no-store so the
    // edge cache can't pin a transient failure for the cache-control
    // window the success path uses.
    return NextResponse.json(
      { products: [], pageInfo: { hasNextPage: false, endCursor: null } },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
