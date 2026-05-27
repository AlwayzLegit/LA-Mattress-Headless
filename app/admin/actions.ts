'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

/**
 * Force-refresh the admin dashboard's underlying caches and re-render
 * the page. Bound to the header's "Refresh" form (POST → server action).
 *
 * Why two invalidations:
 *   - revalidateTag('admin-dashboard') clears the Data Cache entries for
 *     every Shopify Admin GraphQL call (every adminGql() invocation
 *     tagged that string in lib/shopify/admin.ts), so the next render
 *     refetches from Shopify. Since both adminGql and hogQL now run
 *     with `cache: 'no-store'`, the tag bust is a no-op in practice —
 *     left in place for compatibility in case the cache strategy is
 *     re-enabled later.
 *   - revalidatePath('/admin') invalidates the Full Route Cache entry
 *     for the page itself, forcing Next.js to re-render even if no
 *     underlying data dependency changed. With dynamic = 'force-dynamic'
 *     this is also a no-op but kept for clarity.
 *
 * Redirect preserves the current range params (preset or custom from/to,
 * plus the compare flag) so the merchant lands back on the same view
 * they were looking at — the prior version only preserved `range`, so
 * a refresh on a custom-date or compare view silently reset it.
 */
export async function refreshDashboard(formData: FormData): Promise<void> {
  const sp = new URLSearchParams();
  // Whitelist the params the picker uses so the redirect URL stays
  // canonical (no UTM / share-tracker garbage leaks through).
  for (const k of ['range', 'from', 'to', 'compare']) {
    const v = formData.get(k);
    if (typeof v === 'string' && v.length > 0) sp.set(k, v);
  }
  sp.set('refreshed', '1');
  revalidateTag('admin-dashboard');
  revalidatePath('/admin');
  redirect(`/admin?${sp.toString()}`);
}
