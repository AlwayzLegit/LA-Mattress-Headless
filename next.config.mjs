import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadInventoryRedirects() {
  try {
    const raw = readFileSync(resolve(__dirname, 'data/url-inventory/redirects.json'), 'utf8');
    const json = JSON.parse(raw);
    if (!Array.isArray(json.redirects)) return [];
    return json.redirects
      .filter((r) => r && typeof r.source === 'string' && typeof r.destination === 'string')
      .map((r) => ({
        source: r.source,
        destination: r.destination,
        permanent: r.permanent !== false,
      }));
  } catch (err) {
    console.warn('[next.config] Could not load redirects.json:', err.message);
    return [];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Route every <Image> through lib/image-loader.ts. Avoids Vercel's
    // /_next/image optimizer (per-account quota → 402 Payment Required
    // breaks every product photo when exhausted) and uses Shopify's
    // built-in CDN transforms instead — already paid for + edge-cached.
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: 'mattressstoreslosangeles.com' },
    ],
  },
  async redirects() {
    return loadInventoryRedirects();
  },
};

export default nextConfig;
