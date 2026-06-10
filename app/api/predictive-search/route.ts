import { NextResponse } from 'next/server';
import { predictiveSearch } from '@/lib/shopify';

export const runtime = 'edge';

/**
 * Thin proxy for the Storefront predictiveSearch query. Lives on the server
 * so the public token stays out of the client bundle and so the response can
 * be edge-cached briefly when the same query repeats across users.
 *
 * 2-char minimum matches Shopify's own behavior + cuts useless requests on
 * the first keystroke.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return NextResponse.json({ products: [], collections: [], pages: [], articles: [], queries: [] });
  }
  try {
    const data = await predictiveSearch(q);
    return NextResponse.json(data, {
      headers: { 'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch {
    // Upstream (Storefront API) failure. 503 instead of 200-with-empty:
    // the overlay treats !res.ok as an error and falls back to its
    // pre-query state, whereas an empty 200 renders a false "No matches"
    // for whatever the user typed. no-store so the failure can't be
    // edge-cached for the success path's SWR window.
    return NextResponse.json(
      { products: [], collections: [], pages: [], articles: [], queries: [] },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
