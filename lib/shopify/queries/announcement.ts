/**
 * Site-wide announcement bar — fetched from a single-entry Shopify
 * metaobject so the merchant can toggle / edit sale messaging without
 * code changes or a redeploy.
 *
 * Phase 266: replaces the static `<TopBar />` marquee whenever an active
 * announcement exists. "Active" = enabled === true AND (now is within
 * starts_at..ends_at window, or those bounds are not set). Returns null
 * when there's no active announcement, in which case the layout falls
 * back to the regular TopBar.
 *
 * Shopify Admin setup (one-time):
 *   Settings → Custom data → Metaobjects → Add definition
 *     Name: Announcement bar
 *     Type: announcement_bar
 *     Storefronts: ON
 *     Fields:
 *       enabled       Boolean
 *       message       Single line text
 *       cta_label     Single line text  (optional)
 *       cta_href      URL or Single line text  (optional)
 *       style         Single line text, choices: default | accent | urgent
 *       starts_at     Date and time  (optional — auto-hide before this)
 *       ends_at       Date and time  (optional — auto-hide after this)
 *
 *   Content → Metaobjects → Announcement bar → Add entry
 *
 * Caching: 5-minute revalidate, tagged `metaobject:announcement_bar`.
 * Edit-to-live lag is up to 5 minutes; a future webhook (Phase 269)
 * can drop that to seconds via `/api/revalidate-tag`.
 */

import { shopifyFetch } from '../client';

export type AnnouncementStyle = 'default' | 'accent' | 'urgent';

export type Announcement = {
  message: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  style: AnnouncementStyle;
};

type Field = { key: string; value: string | null };

const QUERY = /* GraphQL */ `
  query ActiveAnnouncement {
    metaobjects(type: "announcement_bar", first: 1) {
      edges {
        node {
          id
          handle
          fields { key value }
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

function fieldsToMap(fields: Field[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f.value != null) out[f.key] = f.value;
  }
  return out;
}

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

function normalizeStyle(raw: string | undefined): AnnouncementStyle {
  if (raw === 'accent' || raw === 'urgent') return raw;
  return 'default';
}

export async function getActiveAnnouncement(): Promise<Announcement | null> {
  let data: Raw;
  try {
    data = await shopifyFetch<Raw>(QUERY, {}, {
      next: { revalidate: 300, tags: ['metaobject:announcement_bar'] },
    });
  } catch {
    return null;
  }

  const node = data.metaobjects.edges[0]?.node;
  if (!node) return null;

  const fields = fieldsToMap(node.fields);
  if (fields.enabled !== 'true') return null;
  if (!fields.message) return null;
  if (!isInWindow(fields.starts_at, fields.ends_at)) return null;

  return {
    message: fields.message,
    ctaLabel: fields.cta_label || null,
    ctaHref: fields.cta_href || null,
    style: normalizeStyle(fields.style),
  };
}
