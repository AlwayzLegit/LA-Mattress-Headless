import type { SVGProps } from 'react';

export type IconName =
  | 'search' | 'user' | 'cart' | 'pin' | 'phone'
  | 'arrow-right' | 'arrow-left' | 'arrow-up-right'
  | 'chevron-down' | 'chevron-right'
  | 'menu' | 'close' | 'star' | 'truck' | 'shield' | 'sparkle' | 'card'
  | 'home' | 'check' | 'plus' | 'minus' | 'pause' | 'play' | 'heart'
  | 'mail' | 'bed' | 'alert' | 'lock' | 'chat';

type Props = {
  name: IconName;
  size?: number;
  stroke?: number;
} & Omit<SVGProps<SVGSVGElement>, 'name' | 'stroke'>;

export function Icon({ name, size = 20, stroke = 1.5, ...rest }: Props) {
  const props: SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    // Defense-in-depth: every icon in this codebase sits next to
    // visible text or inside a button/link with its own aria-label.
    // Defaulting to aria-hidden + focusable=false guarantees the
    // SVG is never read as a confusing standalone glyph by SR, and
    // never lands a Tab focus on Edge/IE-legacy paths. Callers that
    // really want the icon to carry meaning can override via ...rest
    // (e.g., role="img" + aria-label).
    'aria-hidden': true,
    focusable: false,
    ...rest,
  };
  switch (name) {
    case 'search':         return (<svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>);
    case 'user':           return (<svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>);
    case 'cart':           return (<svg {...props}><path d="M3 5h2l2.5 11.5a2 2 0 0 0 2 1.5h7.5a2 2 0 0 0 2-1.5L21 9H6"/><circle cx="10" cy="21" r="1"/><circle cx="18" cy="21" r="1"/></svg>);
    case 'pin':            return (<svg {...props}><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>);
    case 'phone':          return (<svg {...props}><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>);
    case 'arrow-right':    return (<svg {...props}><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>);
    case 'arrow-left':     return (<svg {...props}><path d="M19 12H5"/><path d="m11 19-7-7 7-7"/></svg>);
    case 'arrow-up-right': return (<svg {...props}><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>);
    case 'chevron-down':   return (<svg {...props}><path d="m6 9 6 6 6-6"/></svg>);
    case 'chevron-right':  return (<svg {...props}><path d="m9 6 6 6-6 6"/></svg>);
    case 'menu':           return (<svg {...props}><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>);
    case 'close':          return (<svg {...props}><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>);
    case 'star':           return (<svg {...props} fill="currentColor" stroke="none"><path d="m12 2 3 6.5 7 .9-5 4.8 1.3 7-6.3-3.4L5.7 21l1.3-6.8-5-4.8 7-.9z"/></svg>);
    case 'truck':          return (<svg {...props}><path d="M3 17V6h12v11"/><path d="M15 9h4l2 4v4h-6"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>);
    case 'shield':         return (<svg {...props}><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>);
    case 'sparkle':        return (<svg {...props}><path d="M12 3v6"/><path d="M12 15v6"/><path d="M3 12h6"/><path d="M15 12h6"/></svg>);
    case 'card':           return (<svg {...props}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>);
    case 'home':           return (<svg {...props}><path d="m3 11 9-8 9 8"/><path d="M5 9v11h14V9"/></svg>);
    case 'check':          return (<svg {...props}><path d="m5 12 4 4 10-10"/></svg>);
    case 'plus':           return (<svg {...props}><path d="M12 5v14"/><path d="M5 12h14"/></svg>);
    case 'minus':          return (<svg {...props}><path d="M5 12h14"/></svg>);
    case 'pause':          return (<svg {...props}><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>);
    case 'play':           return (<svg {...props}><path d="M7 5v14l12-7z"/></svg>);
    case 'heart':          return (<svg {...props}><path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z"/></svg>);
    case 'mail':           return (<svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>);
    case 'bed':            return (<svg {...props}><path d="M3 18V8"/><path d="M3 13h18v5"/><path d="M21 18V11a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/></svg>);
    case 'alert':          return (<svg {...props}><path d="M12 4 2 20h20z"/><path d="M12 10v5"/><circle cx="12" cy="18" r="0.5" fill="currentColor"/></svg>);
    case 'lock':           return (<svg {...props}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>);
    case 'chat':           return (<svg {...props}><path d="M21 12a8 8 0 0 1-11.3 7.3L4 21l1.7-5.7A8 8 0 1 1 21 12z"/><path d="M8 11h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/></svg>);
    default:               return null;
  }
}
