/**
 * In-memory, per-instance rate limiter for API routes.
 *
 * Fixed-window counters keyed by caller IP + route bucket. Designed for
 * the abuse profile that actually threatens this site: a single source
 * hammering a costly endpoint (/api/chat bills per token via the
 * Anthropic API; /api/newsletter and /api/ccpa-request create Shopify
 * customer records).
 *
 * HONEST SCOPE — this is burst protection, not a global quota:
 *   - State lives in module memory, so each serverless instance / edge
 *     isolate counts independently. A distributed attacker spread across
 *     many instances is throttled per instance, not in aggregate.
 *   - Sequential abuse loops (the common case: a script in a tight loop)
 *     reuse warm instances and ARE effectively capped.
 *   - Upgrading to a durable cross-instance limiter (Upstash / Vercel KV
 *     sliding window) only requires swapping the internals; the
 *     rateLimit() call-site contract is store-agnostic on purpose.
 *
 * Memory: entries are pruned on write once the map exceeds MAX_KEYS, so
 * a key-flooding attacker (spoofed XFF chains) can't grow the map
 * unboundedly within an instance's lifetime.
 */

type WindowEntry = { count: number; resetAt: number };

const buckets = new Map<string, WindowEntry>();

// ~64 bytes/entry; 10k keys ≈ <1 MB — irrelevant next to a Next.js
// instance's baseline footprint, but bounded on principle.
const MAX_KEYS = 10_000;

function pruneExpired(now: number): void {
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
  // Still over cap after dropping expired windows (key-flood): drop
  // oldest-resetting entries first — they're closest to irrelevant.
  if (buckets.size > MAX_KEYS) {
    const overflow = buckets.size - MAX_KEYS;
    const oldest = [...buckets.entries()]
      .sort((a, b) => a[1].resetAt - b[1].resetAt)
      .slice(0, overflow);
    for (const [key] of oldest) buckets.delete(key);
  }
}

export type RateLimitResult = {
  limited: boolean;
  /** Seconds until the current window resets — feed into Retry-After. */
  retryAfterSeconds: number;
};

/**
 * Count a hit against `bucket` for `clientKey` and report whether the
 * caller is over `limit` hits per `windowMs`.
 */
export function rateLimit(
  bucket: string,
  clientKey: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const key = `${bucket}:${clientKey}`;
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) pruneExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  if (entry.count > limit) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { limited: false, retryAfterSeconds: 0 };
}

/**
 * Best-effort caller identity behind Vercel's proxy: first hop of
 * x-forwarded-for (Vercel sets it; the leftmost value is the client),
 * x-real-ip as fallback. 'unknown' lumps header-less callers into one
 * shared bucket — acceptable, since real browsers always carry XFF on
 * Vercel and the shared bucket still bounds aggregate abuse.
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Standard 429 with Retry-After, shared by the rate-limited routes. */
export function rateLimitResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'cache-control': 'no-store',
      },
    },
  );
}
