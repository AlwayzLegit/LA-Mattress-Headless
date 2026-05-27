/**
 * Dashboard date-range model — single source of truth for the
 * "what window are we looking at" decision used by every widget on
 * /admin and its sub-pages.
 *
 * Two shapes the URL can take:
 *   /admin?range=preset_name              — preset (today / 7d / 30d / 90d / mtd / ytd)
 *   /admin?from=YYYY-MM-DD&to=YYYY-MM-DD  — custom span
 *
 * Plus an optional `compare=1` flag that turns on side-by-side
 * previous-period delta rendering in widgets that support it.
 *
 * All times are interpreted in America/Los_Angeles (the merchant
 * operates exclusively in LA) so "Last 7 days" means "the most recent
 * 7 calendar days in LA time", not "the most recent 168 wall-clock
 * hours UTC". This avoids the off-by-one where the merchant runs an
 * end-of-day report in PT but the dashboard's "today" already rolled
 * over to tomorrow in UTC.
 */

export type DateRangePreset =
  | 'today'
  | '7d'
  | '30d'
  | '90d'
  | 'mtd'
  | 'ytd';

export const DATE_RANGE_PRESETS: { key: DateRangePreset; label: string; short: string }[] = [
  { key: 'today', label: 'Today',          short: 'Today' },
  { key: '7d',    label: 'Last 7 days',    short: '7d'    },
  { key: '30d',   label: 'Last 30 days',   short: '30d'   },
  { key: '90d',   label: 'Last 90 days',   short: '90d'   },
  { key: 'mtd',   label: 'Month to date',  short: 'MTD'   },
  { key: 'ytd',   label: 'Year to date',   short: 'YTD'   },
];

export const DEFAULT_PRESET: DateRangePreset = '30d';

/** Resolved time window — every fetcher takes one of these. */
export type DateRange = {
  /** ISO datetime (inclusive). */
  from: string;
  /** ISO datetime (exclusive). */
  to: string;
  /** Number of whole days in the window — for widgets that bucket daily. */
  days: number;
  /** True when this window came from a preset (vs. user-picked dates). */
  isPreset: boolean;
  /** Preset key, when applicable. */
  preset: DateRangePreset | null;
  /** Human label like "Last 30 days" or "May 1 – May 27, 2026". */
  label: string;
};

/**
 * Convert a calendar date string (YYYY-MM-DD, interpreted as a wall-clock
 * date in America/Los_Angeles) into the UTC instant of 00:00 on that
 * date in LA. DST-aware: probes a noon-UTC instant on the target day
 * (always safely far from 2am DST boundaries) and reads the LA offset
 * from Intl.DateTimeFormat's `longOffset` format part.
 */
function laMidnightFromCalendar(yyyy_mm_dd: string): Date {
  const probe = new Date(`${yyyy_mm_dd}T12:00:00Z`);
  const tzPart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'longOffset',
  })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName');
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(tzPart?.value ?? 'GMT-08:00');
  const sign = m && m[1] === '+' ? 1 : -1;
  const offsetMin = m ? sign * (Number.parseInt(m[2], 10) * 60 + Number.parseInt(m[3], 10)) : -480;
  // 00:00 LA wall-clock = 00:00 UTC string − LA offset minutes.
  // For PDT (offsetMin = -420), result is 07:00 UTC; for PST
  // (offsetMin = -480), 08:00 UTC.
  const midnightUtcMs = new Date(`${yyyy_mm_dd}T00:00:00.000Z`).getTime();
  return new Date(midnightUtcMs - offsetMin * 60_000);
}

/**
 * LA-local midnight at-or-before the given Date `d`. Used to anchor
 * "today" / "this month" / "this year" preset boundaries to the
 * merchant's local calendar regardless of where the lambda runs.
 */
function laMidnight(d: Date): Date {
  // Read the LA calendar day for `d`, then resolve that day's midnight.
  const yyyy_mm_dd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return laMidnightFromCalendar(yyyy_mm_dd);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function fmtCalendar(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

function fmtIsoDate(d: Date): string {
  // YYYY-MM-DD in LA time — matches the date-input value format.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Resolve a preset key into an inclusive (from)/exclusive (to) window.
 * `now` is injectable for tests.
 */
export function rangeFromPreset(preset: DateRangePreset, now: Date = new Date()): DateRange {
  const todayStart = laMidnight(now);
  const tomorrowStart = addDays(todayStart, 1);

  let from: Date;
  let to: Date = tomorrowStart;
  let label: string;

  switch (preset) {
    case 'today':
      from = todayStart;
      label = 'Today';
      break;
    case '7d':
      from = addDays(todayStart, -6); // includes today + 6 prior days
      label = 'Last 7 days';
      break;
    case '30d':
      from = addDays(todayStart, -29);
      label = 'Last 30 days';
      break;
    case '90d':
      from = addDays(todayStart, -89);
      label = 'Last 90 days';
      break;
    case 'mtd': {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
      }).format(now).split('-');
      from = laMidnightFromCalendar(`${parts[0]}-${parts[1]}-01`);
      label = 'Month to date';
      break;
    }
    case 'ytd': {
      const yy = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
      }).format(now);
      from = laMidnightFromCalendar(`${yy}-01-01`);
      label = 'Year to date';
      break;
    }
  }

  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    days,
    isPreset: true,
    preset,
    label,
  };
}

/**
 * Resolve a custom from/to string pair (YYYY-MM-DD each) into a
 * DateRange. Invalid input collapses to the default preset.
 */
export function rangeFromCustom(fromStr: string, toStr: string, now: Date = new Date()): DateRange {
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymd.test(fromStr) || !ymd.test(toStr)) {
    return rangeFromPreset(DEFAULT_PRESET, now);
  }
  const fromMid = laMidnightFromCalendar(fromStr);
  const toMid = laMidnightFromCalendar(toStr);
  // Treat `to` as INCLUSIVE in the input (user-friendly) → exclusive
  // upper bound for the query is the next day's start.
  const exclusive = addDays(toMid, 1);
  if (exclusive.getTime() <= fromMid.getTime()) {
    return rangeFromPreset(DEFAULT_PRESET, now);
  }
  const days = Math.max(1, Math.round((exclusive.getTime() - fromMid.getTime()) / 86400000));
  return {
    from: fromMid.toISOString(),
    to: exclusive.toISOString(),
    days,
    isPreset: false,
    preset: null,
    label: `${fmtCalendar(fromMid)} – ${fmtCalendar(toMid)}`,
  };
}

/**
 * Parse the URL searchParams into a resolved DateRange. Tolerates
 * missing/invalid params by falling back to the default preset.
 */
export function parseDateRange(
  params: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): DateRange {
  const get = (k: string): string | null => {
    const v = params[k];
    if (typeof v === 'string') return v;
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') return v[0];
    return null;
  };
  const from = get('from');
  const to = get('to');
  if (from && to) return rangeFromCustom(from, to, now);
  const presetRaw = get('range');
  if (presetRaw && DATE_RANGE_PRESETS.some((p) => p.key === presetRaw)) {
    return rangeFromPreset(presetRaw as DateRangePreset, now);
  }
  return rangeFromPreset(DEFAULT_PRESET, now);
}

/**
 * Compute the immediately-preceding window of equal length — used by
 * widgets that render "vs previous period" deltas.
 */
export function previousRange(r: DateRange): DateRange {
  const from = new Date(r.from);
  const to = new Date(r.to);
  const span = to.getTime() - from.getTime();
  const prevTo = from;
  const prevFrom = new Date(from.getTime() - span);
  return {
    from: prevFrom.toISOString(),
    to: prevTo.toISOString(),
    days: r.days,
    isPreset: false,
    preset: null,
    label: `${fmtCalendar(prevFrom)} – ${fmtCalendar(addDays(prevTo, -1))}`,
  };
}

/**
 * Build the URL search-params dictionary for a given range — used by
 * the picker to construct `<Link>` hrefs and by the compare toggle to
 * round-trip the current state.
 */
export function rangeToSearchParams(r: DateRange, opts: { compare?: boolean } = {}): URLSearchParams {
  const sp = new URLSearchParams();
  if (r.isPreset && r.preset) {
    sp.set('range', r.preset);
  } else {
    const inclusiveTo = addDays(new Date(r.to), -1);
    sp.set('from', fmtIsoDate(new Date(r.from)));
    sp.set('to', fmtIsoDate(inclusiveTo));
  }
  if (opts.compare) sp.set('compare', '1');
  return sp;
}

/** Whether the compare-to-previous flag is set in URL params. */
export function parseCompareFlag(
  params: Record<string, string | string[] | undefined>,
): boolean {
  const v = params['compare'];
  const s = typeof v === 'string' ? v : Array.isArray(v) ? v[0] : null;
  return s === '1' || s === 'true';
}

/**
 * Inclusive (YYYY-MM-DD) representation of a range, used by the date
 * inputs in the picker UI. `to` is the inclusive end of the window
 * (i.e. one day earlier than the exclusive upper bound stored on
 * DateRange).
 */
export function rangeToInputValues(r: DateRange): { from: string; to: string } {
  return {
    from: fmtIsoDate(new Date(r.from)),
    to: fmtIsoDate(addDays(new Date(r.to), -1)),
  };
}
