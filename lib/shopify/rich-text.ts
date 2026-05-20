/**
 * Shopify rich-text JSON → HTML serializer.
 *
 * Shopify's `rich_text_field` metafield type stores its value as a JSON
 * AST, not as raw HTML. The shape is `{ type: 'root', children: [...] }`
 * with node types `paragraph`, `heading`, `list`, `list-item`, `text`,
 * and `link`. Text nodes carry optional `bold` / `italic` formatting
 * flags; link nodes carry `url`, `title`, and `target`.
 *
 * This serializer converts that AST into HTML so the storefront can
 * render the content (via `dangerouslySetInnerHTML`, after running it
 * through `sanitizeShopifyHtml` for the same host-rewrite / redirect-
 * resolution / heading-demotion the rest of the merchant HTML gets).
 *
 * Pure function — no dependencies, no DOM, no parse5. The input is
 * already structured; we just walk it.
 *
 * Authoritative shape reference:
 *   https://shopify.dev/docs/apps/build/custom-data/metafields/list-types#rich-text
 *
 * Security: every text-node value and link-attribute value goes through
 * `escapeText` / `escapeAttr` at its boundary. The output then passes
 * through `sanitizeShopifyHtml` at the render call site, which strips
 * Google-Maps iframes, malformed hrefs, javascript: schemes (via the
 * malformed-href anchor unwrap), tracking params, and host references.
 *
 * Unknown node types are dropped silently. A `console.warn` fires on
 * the first occurrence per type to surface any new Shopify-introduced
 * node shape without breaking production rendering.
 */

export type RichTextTextNode = {
  type: 'text';
  value: string;
  bold?: boolean;
  italic?: boolean;
};

export type RichTextLinkNode = {
  type: 'link';
  url?: string;
  title?: string;
  target?: string;
  children?: RichTextNode[];
};

export type RichTextHeadingNode = {
  type: 'heading';
  level?: number;
  children?: RichTextNode[];
};

export type RichTextListNode = {
  type: 'list';
  listType?: 'unordered' | 'ordered';
  children?: RichTextNode[];
};

export type RichTextSimpleNode = {
  type: 'root' | 'paragraph' | 'list-item';
  children?: RichTextNode[];
};

export type RichTextNode =
  | RichTextTextNode
  | RichTextLinkNode
  | RichTextHeadingNode
  | RichTextListNode
  | RichTextSimpleNode;

const warnedUnknownTypes = new Set<string>();

export function richTextJsonToHtml(jsonStr: string | null | undefined): string {
  if (!jsonStr || typeof jsonStr !== 'string') return '';
  let tree: unknown;
  try {
    tree = JSON.parse(jsonStr);
  } catch {
    return '';
  }
  if (!isObject(tree) || tree.type !== 'root') return '';
  const children = Array.isArray(tree.children) ? tree.children : [];
  return children.map(serializeNode).join('');
}

function serializeNode(n: unknown): string {
  if (!isObject(n)) return '';
  switch (n.type) {
    case 'paragraph':
      return `<p>${serializeChildren(n)}</p>`;
    case 'heading': {
      const raw = typeof n.level === 'number' ? n.level : 2;
      const level = Math.min(Math.max(raw, 1), 6);
      return `<h${level}>${serializeChildren(n)}</h${level}>`;
    }
    case 'list': {
      const tag = n.listType === 'ordered' ? 'ol' : 'ul';
      return `<${tag}>${serializeChildren(n)}</${tag}>`;
    }
    case 'list-item':
      return `<li>${serializeChildren(n)}</li>`;
    case 'link': {
      const url = typeof n.url === 'string' ? escapeAttr(n.url) : '';
      const titleAttr = typeof n.title === 'string' && n.title ? ` title="${escapeAttr(n.title)}"` : '';
      const targetAttr =
        n.target === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${url}"${titleAttr}${targetAttr}>${serializeChildren(n)}</a>`;
    }
    case 'text': {
      const value = typeof n.value === 'string' ? n.value : '';
      let html = escapeText(value);
      if (n.italic) html = `<em>${html}</em>`;
      if (n.bold) html = `<strong>${html}</strong>`;
      return html;
    }
    case 'root':
      return serializeChildren(n);
    default: {
      const t = typeof n.type === 'string' ? n.type : 'unknown';
      if (!warnedUnknownTypes.has(t)) {
        warnedUnknownTypes.add(t);
        console.warn(`[rich-text] unknown node type "${t}" — dropped from output`);
      }
      return '';
    }
  }
}

function serializeChildren(n: { children?: unknown }): string {
  const children = Array.isArray(n.children) ? n.children : [];
  return children.map(serializeNode).join('');
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
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
