'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  DATE_RANGE_PRESETS,
  rangeToInputValues,
  type DateRange,
  type DateRangePreset,
} from '@/lib/dashboard/date-range';

/**
 * Dashboard date-range picker — replaces the prior 7d/30d/90d preset
 * row with:
 *   - 6 preset chips (Today / 7d / 30d / 90d / MTD / YTD)
 *   - A "Custom" chip that opens a two-date popover
 *   - A "Compare to previous period" toggle
 *
 * URL contract (lib/dashboard/date-range.ts owns the parsing):
 *   ?range=30d                                 — preset
 *   ?from=2026-04-01&to=2026-04-30             — custom span (inclusive)
 *   &compare=1                                 — optional compare flag
 *
 * Client component because:
 *   - The custom-range popover needs focus management + outside-click
 *     dismiss + keyboard escape handling, none of which work cleanly
 *     without hooks.
 *   - The compare toggle round-trips the current range into the URL
 *     (otherwise toggling it would reset the range to the default).
 *
 * The page itself stays server-rendered — this client component only
 * controls navigation, never the data.
 */
export function DateRangePicker({
  active,
  compare,
}: {
  active: DateRange;
  compare: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const initialInputs = rangeToInputValues(active);

  // Open/closed state for the custom-range popover. Open by default
  // when the active range is custom so the merchant can immediately
  // re-edit it without an extra click.
  const [customOpen, setCustomOpen] = useState(!active.isPreset);
  const [fromInput, setFromInput] = useState(initialInputs.from);
  const [toInput, setToInput] = useState(initialInputs.to);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Outside-click + Escape close the popover so it doesn't trap focus.
  useEffect(() => {
    if (!customOpen) return;
    function onPointer(e: MouseEvent) {
      if (!popoverRef.current?.contains(e.target as Node)) setCustomOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setCustomOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [customOpen]);

  // Sync inputs when the active range changes (e.g. URL navigation).
  useEffect(() => {
    const fresh = rangeToInputValues(active);
    setFromInput(fresh.from);
    setToInput(fresh.to);
  }, [active.from, active.to]); // eslint-disable-line react-hooks/exhaustive-deps

  function navigate(params: URLSearchParams) {
    if (compare) params.set('compare', '1');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function selectPreset(p: DateRangePreset) {
    setCustomOpen(false);
    const sp = new URLSearchParams();
    sp.set('range', p);
    navigate(sp);
  }

  function applyCustom() {
    if (!fromInput || !toInput) return;
    if (toInput < fromInput) return;
    setCustomOpen(false);
    const sp = new URLSearchParams();
    sp.set('from', fromInput);
    sp.set('to', toInput);
    navigate(sp);
  }

  function toggleCompare() {
    const sp = new URLSearchParams();
    if (active.isPreset && active.preset) {
      sp.set('range', active.preset);
    } else {
      const inputs = rangeToInputValues(active);
      sp.set('from', inputs.from);
      sp.set('to', inputs.to);
    }
    if (!compare) sp.set('compare', '1');
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="dash-range-picker" role="group" aria-label="Date range">
      {DATE_RANGE_PRESETS.map((preset) => {
        const isActive = active.isPreset && active.preset === preset.key;
        return (
          <button
            key={preset.key}
            type="button"
            onClick={() => selectPreset(preset.key)}
            className={`dash-range-btn${isActive ? ' dash-range-btn-active' : ''}`}
            aria-pressed={isActive}
            title={preset.label}
          >
            {preset.short}
          </button>
        );
      })}
      <div ref={popoverRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          className={`dash-range-btn${!active.isPreset ? ' dash-range-btn-active' : ''}`}
          aria-pressed={!active.isPreset}
          aria-expanded={customOpen}
          title={active.isPreset ? 'Custom range' : active.label}
        >
          {active.isPreset ? 'Custom' : active.label}
        </button>
        {customOpen ? (
          <div className="dash-range-popover" role="dialog" aria-label="Custom date range">
            <label>
              From
              <input
                type="date"
                value={fromInput}
                max={toInput || undefined}
                onChange={(e) => setFromInput(e.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={toInput}
                min={fromInput || undefined}
                onChange={(e) => setToInput(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={applyCustom}
              className="dash-range-apply"
              disabled={!fromInput || !toInput || toInput < fromInput}
            >
              Apply
            </button>
          </div>
        ) : null}
      </div>
      <label className="dash-range-compare" title="Compare to the immediately preceding period of the same length">
        <input type="checkbox" checked={compare} onChange={toggleCompare} />
        Compare
      </label>
    </div>
  );
}
