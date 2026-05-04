'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Ctx = { open: boolean; setOpen: (v: boolean) => void };
const FilterShellContext = createContext<Ctx | null>(null);

export function useFilterShell(): Ctx {
  const ctx = useContext(FilterShellContext);
  if (!ctx) throw new Error('useFilterShell must be used inside <FilterShell>');
  return ctx;
}

export function FilterShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
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
