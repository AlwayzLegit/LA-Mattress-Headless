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
 *     refetches from Shopify.
 *   - revalidatePath('/admin/dashboard') invalidates the Full Route
 *     Cache entry for the page itself, forcing Next.js to re-render
 *     even if no underlying data dependency changed.
 *
 * PostHog HogQL queries aren't cached by Next.js at all (they go through
 * a different fetch wrapper without `next.tags`), so they re-execute on
 * every render anyway — no extra invalidation needed there.
 *
 * Redirect preserves the current range so the merchant lands back on
 * the same view they were looking at.
 */
export async function refreshDashboard(formData: FormData): Promise<void> {
  const range = String(formData.get('range') ?? '30d');
  revalidateTag('admin-dashboard');
  revalidatePath('/admin/dashboard');
  redirect(`/admin/dashboard?range=${encodeURIComponent(range)}&refreshed=1`);
}
