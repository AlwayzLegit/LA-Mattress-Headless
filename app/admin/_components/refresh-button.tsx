import { refreshDashboard } from '../actions';
import type { DateRange } from '@/lib/dashboard/date-range';
import { rangeToSearchParams } from '@/lib/dashboard/date-range';

/**
 * "Force-refresh" form button — POSTs to the refreshDashboard server
 * action which busts the admin-dashboard cache tag + revalidates the
 * route, then redirects back with the current range preserved.
 *
 * Hidden fields carry the active range + compare flag so the redirect
 * lands the merchant back on the view they were on. Without this they'd
 * be bounced to the default 30-day window.
 */
export function RefreshButton({ range, compare }: { range: DateRange; compare: boolean }) {
  const params = rangeToSearchParams(range, { compare });
  return (
    <form action={refreshDashboard} className="dash-refresh-form">
      {Array.from(params.entries()).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className="dash-refresh-btn" title="Force refresh — bust cache and re-fetch">
        ↻ Refresh
      </button>
    </form>
  );
}
