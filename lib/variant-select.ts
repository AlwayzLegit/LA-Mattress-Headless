import type { ProductVariant } from './shopify';

/**
 * Shared variant-selection core. Extracted verbatim from the PDP buy box
 * (the `variants.find(...)` / `isAvailable(...)` logic) so the same
 * matching rules drive the buy box AND the in-cart variant editor (and,
 * later, the mobile sticky-ATC sheet). Pure functions, no React — safe
 * to import from server or client.
 */

/** The variant whose option set exactly matches the current selection. */
export function findVariant(
  variants: ProductVariant[],
  selection: Record<string, string>,
): ProductVariant | undefined {
  return variants.find((v) => v.selectedOptions.every((o) => selection[o.name] === o.value));
}

/**
 * Whether choosing `value` for option `name` (holding the rest of the
 * current selection fixed) yields an in-stock variant. Drives the
 * disabled/"unavailable" state on option chips.
 */
export function isOptionAvailable(
  variants: ProductVariant[],
  selection: Record<string, string>,
  name: string,
  value: string,
): boolean {
  return variants.some((v) => {
    if (!v.availableForSale) return false;
    return v.selectedOptions.every((o) =>
      o.name === name ? o.value === value : selection[o.name] === o.value,
    );
  });
}
