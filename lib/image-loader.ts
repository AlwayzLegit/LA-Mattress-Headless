/**
 * Custom Next.js image loader. Bypasses Vercel's `/_next/image` optimizer
 * (which has a per-month source-image quota — once exhausted, every image
 * URL returns 402 Payment Required and renders broken). Shopify and
 * Unsplash already expose well-cached on-the-fly transforms via query
 * params, so we route through them directly. Local assets fall through
 * unchanged.
 *
 * Configured via `images.loader: 'custom'` + `images.loaderFile` in
 * next.config.mjs, which makes Next.js call this for every <Image>.
 */
type LoaderArgs = { src: string; width: number; quality?: number };

export default function imageLoader({ src, width, quality }: LoaderArgs): string {
  const q = quality ?? 75;

  if (src.startsWith('https://cdn.shopify.com/')) {
    // Shopify supports `width`, `height`, `crop`, `format`, `quality`
    // query params on any image URL; the CDN edge transforms + caches.
    const u = new URL(src);
    u.searchParams.set('width', String(width));
    return u.toString();
  }

  if (src.startsWith('https://images.unsplash.com/')) {
    const u = new URL(src);
    u.searchParams.set('w', String(width));
    u.searchParams.set('q', String(q));
    u.searchParams.set('auto', 'format');
    u.searchParams.set('fit', 'crop');
    return u.toString();
  }

  // Local /assets, /_next/static, etc. — serve as-is, Vercel's edge will
  // gzip/brotli the bytes either way.
  return src;
}
