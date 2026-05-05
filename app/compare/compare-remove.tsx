'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/app/_components/icon';

const KEY = 'la-mattress.compare.v1';
const EVENT = 'la-mattress:compare-change';

/**
 * Small "Remove" button that lives in each compare-table column header.
 * Wipes the handle from the localStorage compare set, dispatches the
 * change event so the floating tray + PLP toggle states stay in sync,
 * then refreshes the route so the column drops out of the page.
 */
export function CompareRemove({ handle }: { handle: string }) {
  const router = useRouter();

  const onClick = () => {
    try {
      const raw = window.localStorage.getItem(KEY);
      const items = raw ? (JSON.parse(raw) as { handle: string }[]) : [];
      const next = items.filter((p) => p.handle !== handle);
      window.localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // ignore
    }
    const params = new URLSearchParams(window.location.search);
    const ids = (params.get('ids') ?? '').split(',').filter((h) => h && h !== handle);
    const qs = ids.length ? `?ids=${encodeURIComponent(ids.join(','))}` : '';
    router.replace(`/compare${qs}`);
  };

  return (
    <button type="button" className="compare-remove" onClick={onClick} aria-label={`Remove ${handle} from compare`}>
      <Icon name="close" size={12} /> Remove
    </button>
  );
}
