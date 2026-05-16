import { FREE_DELIVERY_THRESHOLD, FREE_DELIVERY_THRESHOLD_DISPLAY } from '@/lib/site-config';
import { formatMoney } from '@/lib/format';

/**
 * Free white-glove delivery progress toward the $499 threshold. Pure
 * presentational (no hooks / no 'use client') so it renders in both the
 * server cart page and the client cart drawer. Replaces the previous
 * unconditional "Free white-glove delivery applied" copy that asserted
 * free delivery regardless of subtotal.
 */
export function FreeShippingBar({ subtotal }: { subtotal: { amount: string; currencyCode: string } }) {
  const amount = Number.parseFloat(subtotal.amount) || 0;
  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD - amount);
  const unlocked = remaining <= 0;
  const pct = Math.min(100, Math.round((amount / FREE_DELIVERY_THRESHOLD) * 100));

  return (
    <div className="cart-freeship-bar" data-unlocked={unlocked ? 'true' : 'false'}>
      <p className="cart-freeship-msg">
        {unlocked ? (
          <><strong>Free white-glove delivery unlocked</strong> — setup &amp; old-mattress haul-away included.</>
        ) : (
          <>Add{' '}
            <strong className="tnum">
              {formatMoney({ amount: remaining.toFixed(2), currencyCode: subtotal.currencyCode })}
            </strong>{' '}
            more for <strong>free white-glove delivery</strong> ({FREE_DELIVERY_THRESHOLD_DISPLAY}+).
          </>
        )}
      </p>
      <div className="cart-freeship-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progress toward free delivery">
        <div className="cart-freeship-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
