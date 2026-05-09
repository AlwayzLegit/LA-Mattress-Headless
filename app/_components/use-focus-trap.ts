'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Standard modal-style focus trap. While `active` is true:
 *   - Tab from the last focusable element wraps to the first
 *   - Shift+Tab from the first wraps to the last
 *
 * On deactivate, focus returns to whichever element was focused when
 * the trap turned on — so closing a modal lands the keyboard user back
 * on the trigger button instead of the document body.
 *
 * Required by WCAG 2.4.3 (Focus Order) for any dialog. Used by the
 * search overlay, cart drawer, mobile nav drawer, and mobile filter
 * shell.
 *
 * Initial focus is the responsibility of the caller — usually the
 * input in a search modal, or the close button in a drawer. The trap
 * only constrains subsequent Tab navigation.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;

      const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      // Skip elements that are visually hidden (display:none / visibility:hidden).
      const visible = Array.from(nodes).filter((el) => {
        if (el.hidden) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 || r.height > 0;
      });
      if (visible.length === 0) return;

      const first = visible[0];
      const last = visible[visible.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      } else if (activeEl && !container.contains(activeEl)) {
        // Focus drifted outside the modal (rare — tab from an aria-hidden
        // sibling, or a programmatic focus call). Pull it back.
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Restore focus to the trigger element. Wrapped in try/catch
      // because the previous element may have been removed from the
      // DOM by the same close handler that fired this cleanup.
      try {
        previousFocusRef.current?.focus();
      } catch {
        // ignore
      }
      previousFocusRef.current = null;
    };
  }, [active, containerRef]);
}
