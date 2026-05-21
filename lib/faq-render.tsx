import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * FAQ answers are stored as plain strings (see `FaqItem` in lib/faq.ts —
 * intentionally markup-free so `faqJsonLd()` serializes clean structured
 * data). But several answers reference internal paths inline, e.g.
 * "…take our 2-minute sleep quiz at /sleep-quiz" or "…room-fit
 * recommendations are at /pages/mattress-sizes." Rendered as `<p>{a}</p>`
 * those paths show as dead literal text (merchant reported it on the
 * adjustable-beds FAQ).
 *
 * `renderFaqAnswer` is a render-time tokenizer: it keeps the data model
 * plain (JSON-LD still consumes the raw string untouched) and only the
 * VISIBLE answer gets paths/URLs turned into real links with readable
 * anchor text. Apply it wherever an FAQ answer is shown to a human; do
 * NOT feed its output into JSON-LD.
 */

// Friendly anchor text for the handful of internal paths that actually
// appear in FAQ copy. Unknown internal paths fall back to a de-slugged
// Title Case of the last segment so a new path never renders as a raw
// "/pages/whatever" again.
const LABELS: Record<string, string> = {
  '/sleep-quiz': '2-minute sleep quiz',
  '/pages/mattress-sizes': 'mattress size guide',
  '/pages/mattress-store-financing': 'financing options',
  '/pages/warranty': 'warranty coverage',
  '/pages/shipping-and-delivery': 'delivery details',
  '/pages/mattress-store-delivery': 'delivery details',
  '/pages/love-your-bed-guarantee': '120-night guarantee',
  '/pages/mattress-store-locations': 'showroom locations',
  '/pages/mattress-types': 'mattress types compared',
  '/pages/mattress-brands': 'brands we carry',
};

// Internal storefront paths + absolute URLs. Path char class excludes
// the trailing "." so "…/pages/mattress-sizes." links the path and
// leaves the period as text. URLs stop at whitespace or a closing paren.
const TOKEN = /(https?:\/\/[^\s)]+|\/(?:sleep-quiz|pages\/[a-z0-9-]+|blogs\/[a-z0-9/-]+|collections\/[a-z0-9-]+))/g;

function deslug(path: string): string {
  const seg = path.split('/').filter(Boolean).pop() ?? path;
  return seg
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function renderFaqAnswer(answer: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(answer)) !== null) {
    const match = m[0];
    const start = m.index;
    if (start > last) out.push(answer.slice(last, start));
    if (match.startsWith('http')) {
      out.push(
        <a key={`l${i}`} href={match} target="_blank" rel="noopener noreferrer">
          {match.replace(/^https?:\/\//, '').replace(/\/$/, '')}
        </a>,
      );
    } else {
      out.push(
        <Link key={`l${i}`} href={match}>
          {LABELS[match] ?? deslug(match)}
        </Link>,
      );
    }
    last = start + match.length;
    i += 1;
  }
  if (last < answer.length) out.push(answer.slice(last));
  // No tokens found → return the original string unchanged.
  return out.length ? out : answer;
}
