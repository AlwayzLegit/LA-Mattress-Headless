import type { ProductFilter } from '@/lib/shopify';

// URL params we recognize as PLP filters. Everything else (sort, after, etc.)
// is left untouched.
export const FILTER_PARAMS = [
  'vendor',
  'type',
  'size',
  'price',
  // Metafield-backed filters configured by the merchant in Search & Discovery.
  'firmness',     // → custom.comfort_level
  'sleepPosition', // → custom.sleep_positions
  'heightRange',  // → custom.height (bucketed text, e.g. "10-12 inches")
] as const;
export type FilterParam = (typeof FILTER_PARAMS)[number];

// Names a Shopify variant option might use for size — case-insensitive match.
const SIZE_OPTION_NAMES = ['Size', 'size'];

export type FilterSelection = {
  vendor: string[];
  type: string[];
  size: string[];
  firmness: string[];
  sleepPosition: string[];
  heightRange: string[];
  price: { min?: number; max?: number } | null;
};

// Next.js passes a string[] when a query key repeats (?vendor=a&vendor=b)
// or `undefined` when absent — never trust the narrowed string type.
// Flatten arrays so `.split` can't blow up (Sentry LA-MATTRESS-HEADLESS-3:
// "(a ?? "").split is not a function").
type ParamValue = string | string[] | undefined;

const splitCsv = (raw: ParamValue) =>
  (Array.isArray(raw) ? raw.join(',') : raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function parseFilterSelection(
  searchParams: Record<string, ParamValue>,
): FilterSelection {
  const priceParam = searchParams.price;
  const priceRaw = Array.isArray(priceParam) ? priceParam[0] : priceParam;
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
    firmness:      splitCsv(searchParams.firmness),
    sleepPosition: splitCsv(searchParams.sleepPosition),
    heightRange:   splitCsv(searchParams.heightRange),
    price,
  };
}

export function selectionToProductFilters(sel: FilterSelection): ProductFilter[] {
  const filters: ProductFilter[] = [];
  for (const v of sel.vendor) filters.push({ productVendor: v });
  for (const t of sel.type) filters.push({ productType: t });
  for (const s of sel.size) filters.push({ variantOption: { name: SIZE_OPTION_NAMES[0], value: s } });
  for (const v of sel.firmness)      filters.push({ productMetafield: { namespace: 'custom', key: 'comfort_level',   value: v } });
  for (const v of sel.sleepPosition) filters.push({ productMetafield: { namespace: 'custom', key: 'sleep_positions', value: v } });
  for (const v of sel.heightRange)   filters.push({ productMetafield: { namespace: 'custom', key: 'height',          value: v } });
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

/**
 * perf-isr-07: the PLP route is static, so a router.push that only changes
 * query params re-renders nothing server-side — <PlpParamResults> owns the
 * grid for param'd views and needs to hear about the change. Every PLP
 * control that pushes a new query string calls this right after
 * router.push, passing the query string it pushed (window.location.search
 * still holds the OLD value until the soft navigation commits, so the
 * event detail is the source of truth). popstate covers back/forward.
 */
export const PLP_PARAMS_CHANGED_EVENT = 'plp:params-changed';

export function notifyPlpParamsChanged(queryString: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PLP_PARAMS_CHANGED_EVENT, { detail: queryString }));
}

export function hasAnyFilter(sel: FilterSelection): boolean {
  return Boolean(
    sel.vendor.length || sel.type.length || sel.size.length ||
    sel.firmness.length || sel.sleepPosition.length || sel.heightRange.length ||
    sel.price,
  );
}

// Map availableFilter.id → which URL param drives it.
// Shopify's filter IDs follow conventions:
//   filter.p.vendor                          → vendor (productVendor)
//   filter.p.product_type                    → type   (productType)
//   filter.v.option.size                     → size   (variantOption Size)
//   filter.v.price                           → price  (price range)
//   filter.p.m.<namespace>.<key>             → metafield-backed filter
export function paramForFilterId(id: string): FilterParam | null {
  if (id === 'filter.p.vendor') return 'vendor';
  if (id === 'filter.p.product_type') return 'type';
  if (id === 'filter.v.price') return 'price';
  if (id.startsWith('filter.v.option.') && id.toLowerCase().endsWith('.size')) return 'size';
  if (id === 'filter.p.m.custom.comfort_level')   return 'firmness';
  if (id === 'filter.p.m.custom.sleep_positions') return 'sleepPosition';
  if (id === 'filter.p.m.custom.height')          return 'heightRange';
  return null;
}
