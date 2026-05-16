'use client';

import { useState } from 'react';
import Image from 'next/image';

/**
 * Renders a brand logo, falling back to the brand's text wordmark on any
 * load error. The logo sources are interim Clearbit URLs (see
 * lib/brand-logos.ts) which aren't verifiable at build time, so a broken
 * or missing logo must degrade to the wordmark rather than show a broken
 * image. Client component purely for the `onError` boundary.
 */
type Props = {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Shown if the image fails to load. */
  name: string;
};

export function BrandLogo({ src, width, height, alt, name }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="brand-card-wordmark">{name}</span>;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      onError={() => setFailed(true)}
      style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }}
    />
  );
}
