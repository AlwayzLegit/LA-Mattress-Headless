# RFC: PLP v2 — Phase B (wire `custom.seo_content` via a rich-text-JSON serializer)

**Status:** Draft.
**Author:** Engineering (Claude).
**Predecessor:** [`plp-content-layout-v2.md`](./plp-content-layout-v2.md) — Phase A (live layout swap with `descriptionHtml` below grid).
**Live state (2026-05-20):** Phase A code lives on `claude/seo-improvement-plan-wiF00`; the Shopify mutations from `plp-v2-shopify-mutations-2026-05-20.md` are complete (64/64 `intro_short` populated, 10 orphan definitions deleted).
**Unblocks:** Reading the ~586KB of merchant-authored `custom.seo_content` rich-text content (49 of 64 collections) into the headless storefront below the product grid.

---

## 1. Why a follow-up RFC instead of bundling into Phase A

The Phase 2.5 pre-flight audit (2026-05-20) revealed that `custom.seo_content` is the **most-populated** long-content field the merchant authors — heavier and richer than `collection.descriptionHtml`. Phase A treated the metafield as a future opportunity because reading it requires a **rich-text JSON → HTML serializer** that doesn't exist in this codebase yet. Shopify stores `rich_text_field` values as a JSON AST (`{ "type": "root", "children": [{ "type": "heading", "level": 2, "children": [...] }] }`) rather than as raw HTML — the storefront cannot `dangerouslySetInnerHTML` it as-is.

Bundling the serializer into Phase A would have:

1. Doubled Phase A's blast radius (the layout swap is its own scoped change; adding a serializer is its own scoped change).
2. Delayed the layout swap behind serializer review.
3. Coupled two reviews together when they have nothing functionally to do with each other.

Phase B ships once Phase A is merged + stable.

---

## 2. Scope of Phase B

| In scope | Out of scope |
|---|---|
| New `lib/shopify/rich-text.ts` — pure function that converts Shopify's rich-text-JSON AST into safe HTML. | A general-purpose rich-text editor / WYSIWYG. (Shopify Admin already provides this.) |
| Read `custom.seo_content` in the collection query alongside `descriptionHtml`. | Migration of `description_` data → `seo_content` (separate merchant-driven exercise). |
| PLP below-grid render priority: `seoContentHtml ?? descriptionHtml`. | Wiring `seo_content` on product or article pages. |
| Sanitize via existing `sanitizeShopifyHtml({ demoteHeadings: true })`. | Adding new schema.org JSON-LD for the body content (existing CollectionPage/ItemList/FAQPage stays). |
| Unit tests for the serializer (paragraph, heading, list, link, formatting marks). | Removing Phase A's descriptionHtml render path (it stays as fallback). |
| Backfill of `custom.intro_short` for any newly-created collection where it's empty (re-run of the Phase A backfill workflow). | Editorial rewrites of any `seo_content` value. |

---

## 3. Shopify's rich-text JSON shape (live sample)

Inspected sample from `mattresses` collection (2026-05-20 audit):

```json
{
  "type": "root",
  "children": [
    {
      "type": "heading",
      "level": 2,
      "children": [{ "type": "text", "value": "What Is a..." }]
    },
    {
      "type": "paragraph",
      "children": [
        { "type": "text", "value": "After a day there's..." },
        { "type": "text", "value": "bold portion", "bold": true },
        { "type": "link", "url": "/collections/queen", "title": "Queen", "target": "_self", "children": [{ "type": "text", "value": "Queen mattresses" }] }
      ]
    },
    {
      "type": "list",
      "listType": "unordered",
      "children": [
        { "type": "list-item", "children": [{ "type": "text", "value": "..." }] }
      ]
    }
  ]
}
```

**Node types** observed across the 49 populated collections (will validate exhaustively in the test fixtures):

- `root` — top-level wrapper, has `children`.
- `paragraph` — has `children`.
- `heading` — has `level` (1-6, but Shopify Admin only exposes 2-4 in practice) + `children`.
- `list` — has `listType` (`unordered` | `ordered`) + `children`.
- `list-item` — has `children`.
- `text` — has `value` + optional formatting flags `bold` / `italic`.
- `link` — has `url` + `title` + `target` + `children`.

**Out-of-scope node types** (will throw or skip): `image`, `code`, `quote`. Not seen in the live data; revisit if Shopify adds them.

Authoritative reference: [Shopify Dev — Rich text data type](https://shopify.dev/docs/apps/build/custom-data/metafields/list-types#rich-text).

---

## 4. Implementation

### 4.1 New module: `lib/shopify/rich-text.ts`

```ts
// Pseudocode shape — actual implementation in the PR.
export type RichTextNode = {
  type: 'root' | 'paragraph' | 'heading' | 'list' | 'list-item' | 'text' | 'link';
  children?: RichTextNode[];
  // type-specific:
  value?: string;        // text nodes
  level?: number;        // heading nodes
  listType?: 'unordered' | 'ordered';
  url?: string;          // link nodes
  title?: string;        // link nodes
  target?: string;       // link nodes
  bold?: boolean;        // text formatting
  italic?: boolean;      // text formatting
};

export function richTextJsonToHtml(jsonStr: string | null | undefined): string {
  if (!jsonStr) return '';
  let tree: RichTextNode;
  try {
    tree = JSON.parse(jsonStr);
  } catch {
    return '';
  }
  if (tree?.type !== 'root') return '';
  return (tree.children ?? []).map(serializeNode).join('');
}

function serializeNode(n: RichTextNode): string {
  switch (n.type) {
    case 'paragraph': return `<p>${(n.children ?? []).map(serializeNode).join('')}</p>`;
    case 'heading': {
      const level = Math.min(Math.max(n.level ?? 2, 1), 6);
      return `<h${level}>${(n.children ?? []).map(serializeNode).join('')}</h${level}>`;
    }
    case 'list': {
      const tag = n.listType === 'ordered' ? 'ol' : 'ul';
      return `<${tag}>${(n.children ?? []).map(serializeNode).join('')}</${tag}>`;
    }
    case 'list-item': return `<li>${(n.children ?? []).map(serializeNode).join('')}</li>`;
    case 'link': {
      const url = escapeAttr(n.url ?? '');
      const title = escapeAttr(n.title ?? '');
      const target = n.target === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${url}"${title ? ` title="${title}"` : ''}${target}>${(n.children ?? []).map(serializeNode).join('')}</a>`;
    }
    case 'text': {
      let html = escapeText(n.value ?? '');
      if (n.bold) html = `<strong>${html}</strong>`;
      if (n.italic) html = `<em>${html}</em>`;
      return html;
    }
    case 'root': return (n.children ?? []).map(serializeNode).join(''); // defensive
    default: return ''; // skip unknown
  }
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
```

**Why no DOM / parse5 dependency:** the rich-text AST is already structured; we don't need to parse anything. A pure-function serializer keeps the bundle size unchanged and the code easily testable.

**Security:** escaping happens at every text/attribute boundary. Then the output passes through the existing `sanitizeShopifyHtml({ demoteHeadings: true })` for the same host-rewrite / redirect-resolution / heading-demotion as merchant-authored HTML elsewhere — single sanitizer pipeline for ALL Shopify body content.

### 4.2 Query + type changes (~10 LOC)

`lib/shopify/queries/collection.ts`:

```graphql
collection(handle: $handle) {
  ...existing fields...
  introShort: metafield(namespace: "custom", key: "intro_short") { value }
  seoContent: metafield(namespace: "custom", key: "seo_content") { value }   # NEW
}
```

`lib/shopify/types.ts`:

```ts
export type Collection = {
  ...existing fields...
  introShort: string | null;
  seoContentJson: string | null;  // NEW — raw JSON AST string
};
```

The lift in the query handler converts `{value}` → string-or-null on the `seoContentJson` key. The render layer takes care of JSON parse + HTML serialization.

### 4.3 Render priority (~5 LOC)

`app/collections/[handle]/page.tsx`:

```tsx
import { richTextJsonToHtml } from '@/lib/shopify/rich-text';

const longHtml =
  richTextJsonToHtml(collection.seoContentJson) || collection.descriptionHtml || '';

<PlpContentBlock
  handle={collection.handle}
  title={collection.title}
  descriptionHtml={longHtml || null}
/>
```

`<PlpContentBlock>` doesn't change — it already runs `sanitizeShopifyHtml({ demoteHeadings: true })` on whatever HTML it receives. Prop name stays `descriptionHtml` because the contract from its perspective is "long-form HTML to render below grid" regardless of source.

**Priority order rationale:** `seo_content` is heavier and was explicitly authored by the merchant for this purpose (its admin description literally reads "Rich educational content displayed below product grid for SEO"). `descriptionHtml` is the fallback for collections where `seo_content` is empty (15 of 64 today).

### 4.4 Tests

New unit tests in `tests/lib-shopify-rich-text.mjs`:

- Paragraph + text node → `<p>...</p>`.
- Heading level 2 → `<h2>...</h2>`; clamp out-of-band levels (level 0 → h1, level 7 → h6).
- Bold + italic compose: `<strong><em>...</em></strong>`.
- Unordered + ordered lists with nested list-items.
- Link with internal href + target=_self → `<a href="...">...</a>` (no target attr).
- Link with target=_blank → adds `rel="noopener noreferrer"`.
- Text-content escaping: `<script>alert(1)</script>` → `&lt;script&gt;alert(1)&lt;/script&gt;`.
- Attribute escaping: `href="javascript:..."` — note this serializer just escapes the attr value; the URL hygiene happens in `sanitizeShopifyHtml` which already strips `javascript:` schemes (via the malformed-href anchor unwrap, Phase 295).
- Malformed JSON → empty string (no throw).
- Empty/null input → empty string.

Smoke test on live data: parse the 49 populated `seo_content` values from `data-audit-2026-05-20.csv`, run the serializer, assert no throws. Output goes into `data/seo-metafields/rich-text-serializer-smoke-2026-05-20.html` for visual review of the produced HTML.

---

## 5. Rollout

Same shape as Phase A:

1. Code changes on branch → Vercel preview URL → manual smoke on 5+ collections (focus on the ones with the richest seo_content: `mattresses`, `cooling-mattresses`, `mattresses-for-couples` — all 14-15KB rich text).
2. Merge to `main` → 100% production cutover.
3. 48-72h watch window: LCP, INP, CLS, Sentry, PLP→PDP clickthrough rate (same metric the Phase A telemetry already tracks).
4. Instant rollback via Vercel if anything regresses.

**No Shopify mutations needed for Phase B** — the data already exists in `custom.seo_content`. Phase B is a pure code change.

---

## 6. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Unknown rich-text node type lands in production data → silent content drop. | The default branch in `serializeNode` returns `''` (drop the node). Add a server-side `console.warn` for unknown types so any new node Shopify introduces shows up in logs. |
| XSS via merchant-authored content. | Three-layer defense: (1) entity escape at every text/attribute boundary in the serializer; (2) `sanitizeShopifyHtml` post-pass strips Google-Maps iframes, malformed hrefs, tracking params, host references; (3) React's `dangerouslySetInnerHTML` is the final sink, but only after both passes. |
| Heading collisions with the section H2 in `PlpContentBlock`. | Already handled by `sanitizeShopifyHtml({ demoteHeadings: true })` — merchant H1/H2 in the serialized output gets demoted to H3, same as Phase A. |
| `seo_content` field shape changes in a future Shopify schema version. | The serializer's input is JSON the merchant authored via Shopify Admin's rich-text editor — Shopify owns the schema. If they change it, the serializer would need an update; existing data wouldn't break (the test fixtures freeze the current shape). |
| Bundle size growth from the serializer. | ~50 LOC of pure functions, zero new dependencies. Bundle impact: a few hundred bytes after minification. |

---

## 7. Acceptance criteria

- `lib/shopify/rich-text.ts` exists with the serializer, fully unit-tested.
- `getCollectionByHandle` returns `seoContentJson` (raw JSON string).
- `/collections/[handle]` renders `seoContent` (parsed to HTML) below the product grid, falling back to `descriptionHtml` when `seo_content` is empty.
- 49 of 64 collections show seo_content content below grid (the other 15 keep descriptionHtml as today).
- Schema validation green on 5 sample collections.
- LCP / INP / CLS unchanged from pre-Phase-B baseline.
- No new Sentry errors in the 24h post-deploy window.

---

## 8. Effort estimate

~150 LOC total: serializer (~50) + tests (~50) + query/type extension (~10) + page wiring (~10) + smoke fixture (~30). ~1 day of engineering work; 1 day of preview + production verification.

---

## 9. Decision needed

**Approve / amend** the Phase B scope above. Specifically:

1. **Priority order (`seo_content` over `descriptionHtml`)** — yes by default.
2. **Empty-fallback to `descriptionHtml`** — yes by default.
3. **Serializer hand-built (no dependency)** — yes by default. Alternative is `@shopify/storefront-renderer-rich-text` if/when Shopify ships an official one; current state is no first-party serializer, only third-party Hydrogen components which are React-specific and incompatible with our Next.js storefront.

Phase B will not start until Phase A is merged and stable.
