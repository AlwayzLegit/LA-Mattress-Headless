import { permanentRedirect } from 'next/navigation';

/**
 * Legacy URL — the dashboard moved from `/admin/dashboard` to `/admin`
 * (cleaner root, matches industry-standard admin convention). This
 * thin redirect preserves any existing bookmarks and the `range` /
 * `refreshed` query params the old URL used to carry.
 *
 * 308 (permanent) so browsers + search engines update their references.
 * Sentry / runtime logs will fade out hits to this path over time —
 * once they're at ~zero we can delete this directory entirely.
 */
type Params = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// The shared admin layout (app/admin/layout.tsx) renders client
// components (sidebar + toolbar) that depend on useSearchParams.
// Static prerendering of this redirect page would try to render those
// client components without a request, which fails — mark as dynamic
// so the layout resolves at request time, before the redirect fires.
export const dynamic = 'force-dynamic';

export default async function LegacyDashboardRedirect({ searchParams }: Params) {
  const params = await searchParams;
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') usp.set(key, value);
    else if (Array.isArray(value) && typeof value[0] === 'string') usp.set(key, value[0]);
  }
  const qs = usp.toString();
  permanentRedirect(qs ? `/admin?${qs}` : '/admin');
}
