/**
 * Homepage hero carousel slides — fetched from `hero_slide` Shopify
 * metaobjects so the merchant can edit copy + swap images + reorder
 * without code changes or a redeploy.
 *
 * Phase 267: replaces the hardcoded `HERO_SLIDES` constant. When the
 * Shopify fetch returns zero slides (unconfigured store, no entries,
 * fetch failed), the homepage falls back to `FALLBACK_HERO_SLIDES` in
 * `app/_components/hero-slides.ts` so the carousel is never empty.
 *
 * Bonus side effect: hero images move from Unsplash to Shopify CDN
 * (uploaded via Shopify Admin → Files), which is already preconnected
 * in app/layout.tsx and is edge-cached closer to LA users. Should help
 * the unresolved mobile-LCP issue that PSI rev-1 flagged.
 *
 * Shopify Admin setup (one-time):
 *   Settings → Custom data → Metaobjects → Add definition
 *     Name: Hero slide
 *     Type: hero_slide
 *     Multiple entries: YES
 *     Storefronts: ON
 *     Fields:
 *       display_order      Integer  (1, 2, 3, …; used to sort)
 *       enabled            Boolean
 *       eyebrow            Single line text
 *       title              Multi-line text  (newlines = visual line breaks)
 *       body               Multi-line text
 *       bg_image           File reference (image)
 *       bg_image_alt       Single line text  (optional)
 *       primary_label      Single line text
 *       primary_href       URL or Single line text
 *       primary_icon       Single line text  (optional — icon name)
 *       secondary_label    Single line text
 *       secondary_href     URL or Single line text
 *       accent             Boolean  (optional — accent-color treatment)
 *
 *   Content → Metaobjects → Hero slide → Add entry  (create 3)
 *
 * Caching: 5-minute revalidate, tagged `metaobject:hero_slide`.
 */

import { shopifyFetch } from '../client';
import type { IconName } from '@/app/_components/icon';

export type HeroSlideData = {
  eyebrow: string;
  title: string;
  body: string;
  primary: { label: string; icon?: IconName; href: string };
  secondary: { label: string; href: string };
  bgImage: { url: string; altText: string | null };
  accent?: boolean;
};

type Field = {
  key: string;
  value: string | null;
  reference: { __typename?: string; image?: { url: string; altText: string | null } | null } | null;
};

const QUERY = /* GraphQL */ `
  query HeroSlides {
    metaobjects(type: "hero_slide", first: 10) {
      edges {
        node {
          id
          handle
          fields {
            key
            value
            reference {
              __typename
              ... on MediaImage {
                image { url altText }
              }
            }
          }
        }
      }
    }
  }
`;

type Raw = {
  metaobjects: {
    edges: { node: { id: string; handle: string; fields: Field[] } }[];
  };
};

function fieldsToMap(fields: Field[]): Record<string, Field> {
  const out: Record<string, Field> = {};
  for (const f of fields) out[f.key] = f;
  return out;
}

function parseInt10(s: string | null | undefined, fallback: number): number {
  if (!s) return fallback;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Phase 277: hero slides can optionally declare a `starts_at`/`ends_at`
 * date window for scheduled sale takeovers. Outside the window the slide
 * is skipped exactly like `enabled: false`. Bounds default to "always
 * on" when either field is empty.
 */
function isInWindow(startsAt: string | undefined, endsAt: string | undefined): boolean {
  const now = Date.now();
  if (startsAt) {
    const t = Date.parse(startsAt);
    if (Number.isFinite(t) && now < t) return false;
  }
  if (endsAt) {
    const t = Date.parse(endsAt);
    if (Number.isFinite(t) && now > t) return false;
  }
  return true;
}

export async function getHeroSlides(): Promise<HeroSlideData[]> {
  let data: Raw;
  try {
    data = await shopifyFetch<Raw>(QUERY, {}, {
      next: { revalidate: 300, tags: ['metaobject:hero_slide'] },
    });
  } catch {
    return [];
  }

  const slides: { order: number; slide: HeroSlideData }[] = [];
  for (const edge of data.metaobjects.edges) {
    const f = fieldsToMap(edge.node.fields);

    // Required fields — skip the slide if any are missing.
    const enabled = f.enabled?.value === 'true';
    if (!enabled) continue;

    // Phase 277: date-window gating. Slide is hidden before starts_at
    // and after ends_at; both bounds default to "always on" when empty.
    // Enables scheduling sale-takeover slides in advance.
    if (!isInWindow(f.starts_at?.value || undefined, f.ends_at?.value || undefined)) continue;

    const eyebrow = f.eyebrow?.value ?? '';
    const title = f.title?.value ?? '';
    const body = f.body?.value ?? '';
    const primaryLabel = f.primary_label?.value ?? '';
    const primaryHref = f.primary_href?.value ?? '';
    const secondaryLabel = f.secondary_label?.value ?? '';
    const secondaryHref = f.secondary_href?.value ?? '';
    const image = f.bg_image?.reference?.image;
    if (!eyebrow || !title || !body || !primaryLabel || !primaryHref || !secondaryLabel || !secondaryHref || !image) {
      continue;
    }

    const order = parseInt10(f.display_order?.value, 999);
    const slide: HeroSlideData = {
      eyebrow,
      title,
      body,
      primary: {
        label: primaryLabel,
        href: primaryHref,
        ...(f.primary_icon?.value ? { icon: f.primary_icon.value as IconName } : {}),
      },
      secondary: { label: secondaryLabel, href: secondaryHref },
      bgImage: {
        url: image.url,
        altText: f.bg_image_alt?.value || image.altText || null,
      },
      ...(f.accent?.value === 'true' ? { accent: true } : {}),
    };
    slides.push({ order, slide });
  }

  slides.sort((a, b) => a.order - b.order);
  return slides.map((s) => s.slide);
}
