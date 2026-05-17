import { getPageByHandle } from '@/lib/shopify';
import { getPageJsonLd } from '@/lib/page-jsonld';

/**
 * Segment layout for /pages/[handle]. Its only job is to emit the
 * page-specific JSON-LD HERE — in the layout, which is NOT wrapped by
 * loading.tsx's Suspense boundary — instead of inside page.tsx.
 *
 * When the id-bearing <script> tags lived in the streamed page subtree,
 * React's hidden streaming-source node (<div hidden id="S:0">) was left
 * in the DOM on hard load, duplicating every script (cowork QA P1-2,
 * template-wide). Rendering them from the layout is duplication-proof
 * (same reason the root layout's Organization/WebSite scripts never
 * duplicated) and the layout re-renders per handle on client nav, which
 * also clears the stale-schema-on-soft-nav leak.
 *
 * getPageByHandle is React.cache()-memoized, so this and page.tsx share
 * a single Storefront request per render.
 */
export default async function PageHandleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const page = await getPageByHandle(handle).catch(() => null);
  const ld = page ? getPageJsonLd(page) : [];

  return (
    <>
      {ld.map(({ key, data }) => (
        <script
          key={key}
          id={key}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
      {children}
    </>
  );
}
