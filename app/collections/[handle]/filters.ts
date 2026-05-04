import type { ProductFilter } from '@/lib/shopify';

// URL params we recognize as PLP filters. Everything else (sort, after, etc.)
// is left untouched.
export const FILTER_PARAMS = ['vendor', 'type', 'size', 'price'] as const;
export type FilterParam = (typeof FILTER_PARAMS)[number];

// Names a Shopify variant option might use for size — case-insensitive match.
const SIZE_OPTION_NAMES = ['Size', 'size'];

export type FilterSelection = {
  vendor: string[];
  type: string[];
  size: string[];
  price: { min?: number; max?: number } | null;
};

const splitCsv = (raw: string | undefined) =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function parseFilterSelection(searchParams: Record<string, string | undefined>): FilterSelection {
  const priceRaw = searchParams.price;
  let price: FilterSelection['price'] = null;
  if (priceRaw) {
    const m = /^(\d+(?:\.\d+)?)?-(\d+(?:\.\d+)?)?$/.exec(priceRaw);
    if (m) {
      const min = m[1] ? Number.parseFloat(m[1]) : undefined;
      const max = m[2] ? Number.parseFloat(m[2]) : undefined;
      if (Number.isFinite(min) || Number.isFinite(max)) price = { min, max };
    }
  }
  return {
    vendor: splitCsv(searchParams.vendor),
    type:   splitCsv(searchParams.type),
    size:   splitCsv(searchParams.size),
    price,
  };
}

export function selectionToProductFilters(sel: FilterSelection): ProductFilter[] {
  const filters: ProductFilter[] = [];
  for (const v of sel.vendor) filters.push({ productVendor: v });
  for (const t of sel.type) filters.push({ productType: t });
  for (const s of sel.size) filters.push({ variantOption: { name: SIZE_OPTION_NAMES[0], value: s } });
  if (sel.price && (sel.price.min !== undefined || sel.price.max !== undefined)) {
    const range: { min?: number; max?: number } = {};
    if (sel.price.min !== undefined) range.min = sel.price.min;
    if (sel.price.max !== undefined) range.max = sel.price.max;
    filters.push({ price: range });
  }
  return filters;
}

// Build a new URLSearchParams from current params + a {param, value, op} change.
// `op = 'toggle'` flips a CSV value; `op = 'set'` replaces; `op = 'clear'` removes.
export function withFilterChange(
  current: URLSearchParams,
  change: { param: FilterParam; value?: string; op: 'toggle' | 'set' | 'clear' },
): URLSearchParams {
  const next = new URLSearchParams(current);
  // Whenever a filter changes, reset the cursor — `after` only makes sense
  // with the prior result set.
  next.delete('after');

  if (change.op === 'clear') {
    next.delete(change.param);
    return next;
  }
  if (change.op === 'set') {
    if (change.value) next.set(change.param, change.value);
    else next.delete(change.param);
    return next;
  }
  // toggle CSV
  const cur = splitCsv(next.get(change.param) ?? '');
  if (!change.value) return next;
  const i = cur.indexOf(change.value);
  if (i >= 0) cur.splice(i, 1);
  else cur.push(change.value);
  if (cur.length) next.set(change.param, cur.join(','));
  else next.delete(change.param);
  return next;
}

export function clearAllFilters(current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const p of FILTER_PARAMS) next.delete(p);
  next.delete('after');
  return next;
}

export function hasAnyFilter(sel: FilterSelection): boolean {
  return Boolean(
    sel.vendor.length || sel.type.length || sel.size.length || sel.price,
  );
}

// Map availableFilter.id → which URL param drives it.
// Shopify's filter IDs follow conventions:
//   filter.p.vendor          → vendor (productVendor)
//   filter.p.product_type    → type   (productType)
//   filter.v.option.size     → size   (variantOption Size)
//   filter.v.price           → price  (price range)
export function paramForFilterId(id: string): FilterParam | null {
  if (id === 'filter.p.vendor') return 'vendor';
  if (id === 'filter.p.product_type') return 'type';
  if (id === 'filter.v.price') return 'price';
  if (id.startsWith('filter.v.option.') && id.toLowerCase().endsWith('.size')) return 'size';
  return null;
}
