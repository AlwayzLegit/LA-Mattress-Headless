/**
 * PDP static data — sizes the `BuyBox` references but doesn't need React
 * for. Phase 208 extraction sets the convention for future PDP component
 * splits (e.g. sticky bar in Phase 209): keep static data, types, and
 * configuration in `.ts` modules outside the `'use client'` boundary so
 * server components can import them too if they ever need to.
 */

/**
 * Standard mattress size dimensions used by the per-size sublabel in the
 * design's `.pdp-size` cards. Industry-standard sizes, brand-independent.
 * If the merchant uses a non-canonical label (e.g. "Olympic Queen") the
 * `[k] ?? null` lookup falls back to no sublabel.
 */
export const SIZE_DIMENSIONS: Record<string, string> = {
  'Twin':                  '38" × 75"',
  'Twin XL':               '38" × 80"',
  'Full':                  '54" × 75"',
  'Full XL':               '54" × 80"',
  'Queen':                 '60" × 80"',
  'King':                  '76" × 80"',
  'California King':       '72" × 84"',
  'Cal King':              '72" × 84"',
  'Split King':            'Two 38" × 80"',
  'Split California King': 'Two 36" × 84"',
  'Split Cal King':        'Two 36" × 84"',
};
