'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

/**
 * Delegated click tracking for the storefront's local-intent CTAs:
 * `tel:` links → `phone_click`, Google-Maps links → `directions_click`.
 *
 * Round 12 (admin/usage review): for a showroom-led business the
 * highest-value online conversion is a phone call or a drive to a
 * store, and neither was instrumented — the phone_click events in the
 * shared JetNine PostHog project all came from other properties. tel:
 * and maps links are rendered by a dozen mostly-server components
 * (topbar, footer, location cards, sale/contact/service/legal pages),
 * so instead of converting each to a client component, one document-
 * level listener catches them all — including any link added in the
 * future.
 *
 * The listener is passive with respect to navigation: it never calls
 * preventDefault, and `track` is fire-and-forget (PostHog batches to
 * localStorage, so the event survives the page unloading into the
 * dialer / maps app).
 */

function areaOf(el: Element): 'header' | 'footer' | 'main' {
  if (el.closest('header, .topbar')) return 'header';
  if (el.closest('footer')) return 'footer';
  return 'main';
}

const MAPS_HREF = /(?:google\.[^/]+\/maps|maps\.google\.|maps\.app\.goo\.gl)/i;

export function ContactClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const anchor = target?.closest?.('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (href.startsWith('tel:')) {
        track('phone_click', { page: window.location.pathname, area: areaOf(anchor) });
      } else if (MAPS_HREF.test(href)) {
        track('directions_click', { page: window.location.pathname, area: areaOf(anchor) });
      }
    };
    // Capture phase so the event is seen even if a widget stops
    // propagation during bubbling.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
