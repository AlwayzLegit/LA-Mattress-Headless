'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/app/_components/icon';
import { announce } from '@/app/_components/announcer';
import { readCompareSet, writeCompareSet } from '@/app/_components/compare-store';

type Props = {
  handle: string;
  /**
   * Product title for SR-context aria-labels. Optional so the button
   * still renders if a caller hasn't been updated — falls back to the
   * URL handle, which is at least unique. Compare table already has
   * the title in scope, so passing it lets SR users hear "Remove
   * Tempur-Pedic ProAdapt..." instead of the slug.
   */
  title?: string;
};

/**
 * Small "Remove" button that lives in each compare-table column header.
 * Wipes the handle from the localStorage compare set, dispatches the
 * change event so the floating tray + PLP toggle states stay in sync,
 * then refreshes the route so the column drops out of the page.
 *
 * Phase 235: previously open-coded the localStorage read / write /
 * event-dispatch in-line with hardcoded KEY / EVENT constants. Now
 * routes through the shared `compare-store` API (Phase 212), so if the
 * storage key, event name, or schema ever changes, this consumer
 * follows automatically.
 */
export function CompareRemove({ handle, title }: Props) {
  const router = useRouter();
  const ofWhat = title ?? handle;

  const onClick = () => {
    const items = readCompareSet();
    writeCompareSet(items.filter((p) => p.handle !== handle));
    const params = new URLSearchParams(window.location.search);
    const ids = (params.get('ids') ?? '').split(',').filter((h) => h && h !== handle);
    const qs = ids.length ? `?ids=${encodeURIComponent(ids.join(','))}` : '';
    announce(`Removed ${ofWhat} from compare`);
    router.replace(`/compare${qs}`);
  };

  return (
    <button type="button" className="compare-remove" onClick={onClick} aria-label={`Remove ${ofWhat} from compare`}>
      <Icon name="close" size={12} /> Remove
    </button>
  );
}
