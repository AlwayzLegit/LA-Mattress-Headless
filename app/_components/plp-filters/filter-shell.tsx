'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useBodyScrollLock } from '../use-body-scroll-lock';

type Ctx = { open: boolean; setOpen: (v: boolean) => void };
const FilterShellContext = createContext<Ctx | null>(null);

export function useFilterShell(): Ctx {
  const ctx = useContext(FilterShellContext);
  if (!ctx) throw new Error('useFilterShell must be used inside <FilterShell>');
  return ctx;
}

export function FilterShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Stack-aware body scroll lock for the mobile filter drawer.
  useBodyScrollLock(open);

  // Mirror the sheet's open state onto <body> so globals.css can hide
  // the floating chat bubble (z-90) while the sheet (z-60) is up —
  // otherwise the bubble covers the right end of the full-width
  // "Show results" button on phones. Same pattern as body.pdp-sheet-open
  // in BuyBox.
  useEffect(() => {
    document.body.classList.toggle('plp-filters-open', open);
    return () => document.body.classList.remove('plp-filters-open');
  }, [open]);

  // Close on Escape; close when viewport grows past the mobile breakpoint.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const mql = window.matchMedia('(min-width: 881px)');
    const onResize = () => { if (mql.matches) setOpen(false); };
    document.addEventListener('keydown', onKey);
    mql.addEventListener('change', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      mql.removeEventListener('change', onResize);
    };
  }, [open]);

  return (
    <FilterShellContext.Provider value={{ open, setOpen }}>
      {children}
    </FilterShellContext.Provider>
  );
}
