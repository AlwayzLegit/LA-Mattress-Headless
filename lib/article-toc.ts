/**
 * Server-side helper for the article PDP-equivalent (`/blogs/[blog]/[article]`).
 *
 * Walks already-sanitized Shopify article HTML, finds every top-level
 * `<h2>` heading, and:
 *   - emits an `id="..."` attribute on each (slugged from the heading
 *     text), unless one is already present,
 *   - returns a parallel list of { id, text } for the design's `.gd-toc`
 *     sticky table-of-contents column.
 *
 * The transformation is purely textual (regex), which is enough because
 * sanitize.ts has already removed scripts / iframes / unbalanced tags
 * upstream and the H2 grammar in the wild is consistent.
 *
 * If two headings happen to slug to the same string, we suffix `-2`,
 * `-3`, ... so anchor links stay unique.
 */
export type Heading = { id: string; text: string };

const H2_RE = /<h2(\s[^>]*?)?>([\s\S]*?)<\/h2>/gi;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’“”]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'section';
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function injectHeadingIds(html: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const used = new Set<string>();

  const next = html.replace(H2_RE, (_full, attrs: string | undefined, inner: string) => {
    const a = attrs ?? '';
    const text = stripTags(inner);
    if (!text) return _full;

    // Respect a pre-existing id="..." if the merchant authored one.
    const idAttrMatch = /\bid\s*=\s*"([^"]+)"/i.exec(a);
    let id: string;
    if (idAttrMatch) {
      id = idAttrMatch[1];
    } else {
      id = slugify(text);
      let n = 2;
      while (used.has(id)) id = `${slugify(text)}-${n++}`;
    }
    used.add(id);
    headings.push({ id, text });

    if (idAttrMatch) return `<h2${a}>${inner}</h2>`;
    return `<h2${a} id="${id}">${inner}</h2>`;
  });

  return { html: next, headings };
}
