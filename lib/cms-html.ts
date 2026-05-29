/**
 * Small HTML transforms applied to merchant-authored CMS bodies before
 * they're injected into a styled template (comparison + contact pages).
 */

/**
 * Wrap each <table> in a horizontal-scroll container (.cmp-table-scroll)
 * so a wide table scrolls within its column instead of blowing out the
 * layout on narrow viewports, and so the shared `.cmp-table-scroll`
 * styling (card border, navy header, pinned first column) can attach.
 *
 * The table markup is untouched — screen readers still announce it as a
 * table; only a presentational scroll wrapper is added. CMS bodies never
 * nest tables, so the open/close swap is unambiguous.
 */
export function wrapCmsTables(html: string): string {
  return html
    .replace(/<table/g, '<div class="cmp-table-scroll"><table')
    .replace(/<\/table>/g, '</table></div>');
}
