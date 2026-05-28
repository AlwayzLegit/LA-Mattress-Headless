/**
 * Diagnostic endpoint — probes multiple candidate Judge.me endpoints
 * to find one that responds with valid aggregate data. The original
 * /widgets/index_information returns Judge.me's generic 404 HTML
 * (confirmed via earlier debug run), so Judge.me has migrated that
 * endpoint and we need to discover the new one.
 *
 * Token is NEVER returned (only host/path + 4-char prefix + length).
 * NoIndex header set. Delete this endpoint once the right endpoint
 * is identified + the lib/judgeme.ts call site is updated.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type ProbeResult = {
  url: string;
  status: number | 'fetch-threw';
  contentType?: string;
  bodyPrefix: string;
};

async function probe(url: string): Promise<ProbeResult> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const body = await res.text().catch(() => '<unreadable>');
    return {
      url: url.split('?')[0],
      status: res.status,
      contentType: res.headers.get('content-type') ?? undefined,
      bodyPrefix: body.slice(0, 300),
    };
  } catch (err) {
    return {
      url: url.split('?')[0],
      status: 'fetch-threw',
      bodyPrefix: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET(): Promise<NextResponse> {
  const token = process.env.JUDGEME_API_TOKEN;
  const shop = process.env.JUDGEME_SHOP_DOMAIN;
  if (!token || !shop) {
    return NextResponse.json(
      { ok: false, cause: 'env-missing', token_present: Boolean(token), shop_present: Boolean(shop) },
      { status: 503, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    );
  }

  // Candidate endpoint shapes — Judge.me has migrated their public REST
  // endpoints away from /widgets/index_information (confirmed 404 on
  // that path). Probe each candidate and report which (if any) returns
  // 200 + JSON. The merchant's response will narrow down which one to
  // use in lib/judgeme.ts.
  const candidates = [
    `https://judge.me/api/v1/widgets/index_information?api_token=${token}&shop_domain=${shop}`,
    `https://api.judge.me/api/v1/widgets/index_information?api_token=${token}&shop_domain=${shop}`,
    `https://api.judge.me/v1/widgets/index_information?api_token=${token}&shop_domain=${shop}`,
    `https://app.judge.me/api/v1/widgets/index_information?api_token=${token}&shop_domain=${shop}`,
    `https://judge.me/api/v1/reviews/index_information?api_token=${token}&shop_domain=${shop}`,
    `https://judge.me/api/v1/shop?api_token=${token}&shop_domain=${shop}`,
    `https://judge.me/api/v1/reviews/count?api_token=${token}&shop_domain=${shop}`,
    `https://judge.me/api/v1/reviews?api_token=${token}&shop_domain=${shop}&per_page=1`,
    `https://cache.judge.me/widgets/index_information?api_token=${token}&shop_domain=${shop}`,
    `https://cdn.judge.me/widgets/index_information?api_token=${token}&shop_domain=${shop}`,
    `https://judge.me/api/v1/widget_settings?api_token=${token}&shop_domain=${shop}`,
    // No-auth public widget badge — works with any shop_domain, no token needed.
    `https://judge.me/shops/${encodeURIComponent(shop)}/badge`,
  ];

  const results = await Promise.all(candidates.map(probe));

  return NextResponse.json(
    {
      shop_domain_used: shop,
      token_present: true,
      token_length: token.length,
      token_prefix: token.slice(0, 4),
      probes: results,
    },
    { status: 200, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
  );
}
