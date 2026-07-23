'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../icon';
import { hasGpcSignal, hasStoredOptOut, setStoredOptOut } from '@/lib/privacy-optout';

/**
 * Browser-level sale/share opt-out status + one-click toggle, rendered
 * at the top of /pages/data-sharing-opt-out (Round 13, CCPA regs
 * effective 2026-01-01).
 *
 * Two of the 2026 requirements land here:
 *  - Businesses honoring Global Privacy Control must DISPLAY that the
 *    signal was received and honored, not just process it silently.
 *  - The sale/share opt-out must be "symmetrical": no more steps to
 *    opt out than to opt back in, and no identity verification. The
 *    request form below this component stays for access/delete/correct
 *    (where verification is allowed); the pure opt-out is this single
 *    button.
 *
 * State renders post-mount only (initial `null`) so the static HTML is
 * identical for every visitor and there's no hydration mismatch.
 */
export function PrivacySignalStatus() {
  const [state, setState] = useState<{ gpc: boolean; stored: boolean } | null>(null);

  useEffect(() => {
    setState({ gpc: hasGpcSignal(), stored: hasStoredOptOut() });
  }, []);

  if (!state) return null;

  const optedOut = state.gpc || state.stored;

  return (
    <section
      className="ccpa-signal"
      aria-live="polite"
      style={{
        maxWidth: 720,
        marginBottom: 'var(--s-6)',
        padding: 'var(--s-4) var(--s-5)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-4)',
        background: 'var(--surface-2)',
      }}
    >
      <h2 className="h3" style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name={optedOut ? 'check' : 'shield'} size={18} />
        {optedOut ? 'This browser is opted out of sale and sharing' : 'Opt out on this browser'}
      </h2>
      {state.gpc ? (
        <p className="muted" style={{ margin: '0 0 var(--s-3)', lineHeight: 1.55 }}>
          Your browser sent a <strong>Global Privacy Control</strong> signal. We&rsquo;ve honored
          it: this browser is treated as opted out of the sale or sharing of personal
          information, and advertising-related analytics are disabled.
        </p>
      ) : state.stored ? (
        <p className="muted" style={{ margin: '0 0 var(--s-3)', lineHeight: 1.55 }}>
          You&rsquo;ve opted this browser out of the sale or sharing of personal information.
          Advertising-related analytics are disabled. This preference is stored on this
          browser only, use the form below (or GPC) to cover other browsers and devices.
        </p>
      ) : (
        <p className="muted" style={{ margin: '0 0 var(--s-3)', lineHeight: 1.55 }}>
          One click, no form, effective immediately on this browser. To opt out across all
          your browsers automatically, enable{' '}
          <a href="https://globalprivacycontrol.org/" target="_blank" rel="noopener noreferrer">
            Global Privacy Control
          </a>
          {' '}, we honor it.
        </p>
      )}
      {state.gpc ? null : (
        <button
          type="button"
          className={state.stored ? 'btn btn-ghost' : 'btn btn-primary'}
          onClick={() => {
            setStoredOptOut(!state.stored);
            setState({ gpc: state.gpc, stored: !state.stored });
          }}
        >
          {state.stored ? 'Opt back in on this browser' : 'Opt out of sale/sharing on this browser'}
        </button>
      )}
    </section>
  );
}
