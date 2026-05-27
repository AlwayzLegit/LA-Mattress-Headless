import { cache } from 'react';
import { shopifyFetch } from '../client';

/**
 * Live FAQ feed from `faq_item` Shopify metaobjects. One metaobject
 * type drives three storefront surfaces:
 *
 *   - Homepage FAQ section (items with show_on_homepage=true, capped at 10)
 *   - /pages/faq grouped sections (all items, bucketed by `section`)
 *   - FAQPage JSON-LD (per surface — homepage emits its subset,
 *     /pages/faq emits the full list)
 *
 * Field key convention:
 *   display_order (int) — sort within a section, also defines section
 *     order via min(display_order) per section
 *   question (string)
 *   answer (multi_line — plain text only; serializes into JSON-LD)
 *   section (string) — bucket label for /pages/faq grouping
 *   show_on_homepage (boolean) — filter for the homepage subset
 *
 * React.cache-memoized so homepage + /pages/faq + JSON-LD emitter share
 * one Storefront request per render. ISR-cached 1h with tag
 * `metaobject:faq_item` so the existing /api/revalidate webhook handler
 * invalidates merchant edits automatically.
 */

export type LiveFaqItem = {
  displayOrder: number;
  question: string;
  answer: string;
  section: string;
  showOnHomepage: boolean;
};

const QUERY = /* GraphQL */ `
  query LiveFaqItems {
    metaobjects(type: "faq_item", first: 50, sortKey: "display_order") {
      nodes {
        id
        handle
        fields { key value }
      }
    }
  }
`;

type RawField = { key: string; value: string | null };
type RawResponse = {
  metaobjects: {
    nodes: { id: string; handle: string; fields: RawField[] }[];
  };
};

function getStr(fields: Map<string, RawField>, key: string): string | undefined {
  const f = fields.get(key);
  return typeof f?.value === 'string' && f.value.length > 0 ? f.value : undefined;
}

export const getFaqItems = cache(async (): Promise<LiveFaqItem[]> => {
  try {
    const data = await shopifyFetch<RawResponse>(
      QUERY,
      {},
      { next: { revalidate: 3600, tags: ['metaobject:faq_item'] } },
    );
    const items = data.metaobjects.nodes
      .map((node): LiveFaqItem | null => {
        const fields = new Map(node.fields.map((f) => [f.key, f]));
        const question = getStr(fields, 'question');
        const answer = getStr(fields, 'answer');
        const section = getStr(fields, 'section');
        if (!question || !answer || !section) return null;
        const displayRaw = getStr(fields, 'display_order');
        const displayOrder = displayRaw ? Number.parseInt(displayRaw, 10) : 0;
        return {
          displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
          question,
          answer,
          section,
          showOnHomepage: getStr(fields, 'show_on_homepage') === 'true',
        };
      })
      .filter((x): x is LiveFaqItem => x !== null);
    // Dedupe by question text — defense against duplicate metaobjects
    // emitting the same Q&A twice in the accordion and the JSON-LD.
    const seen = new Set<string>();
    return items.filter((it) => {
      const key = it.question.trim().toLowerCase();
      if (key.length === 0 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
});
