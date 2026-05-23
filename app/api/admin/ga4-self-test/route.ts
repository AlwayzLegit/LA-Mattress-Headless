/**
 * TEMPORARY: GA4 server-side purchase mirror self-test.
 *
 * Fires a synthetic `purchase` event via the same `sendGa4Purchase`
 * code path the order-paid webhook uses, then returns the result. Lets
 * us verify that:
 *   - GA4_MEASUREMENT_API_SECRET is set + valid
 *   - GA4_MEASUREMENT_ID (or NEXT_PUBLIC_GA_MEASUREMENT_ID fallback) is set
 *   - The Measurement Protocol call reaches Google with no validation errors
 *
 * Without making a real test order in Shopify (which would leave an
 * artifact in order history).
 *
 * Token-gated query param so a random visitor can't trigger a fake
 * purchase event on GA4. Will be deleted after the verification.
 *
 * Usage:
 *   curl -i 'https://<deployment>/api/admin/ga4-self-test?token=ga4-self-test-2026-05-23'
 *
 * Response: 200 with a JSON body listing any validation messages from
 * GA4's /debug/mp/collect endpoint. Empty validationMessages = the
 * payload was accepted and a real event was also recorded.
 *
 * DELETE THIS FILE AFTER VERIFICATION.
 */

import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Inline copy of sendGa4Events with the debug endpoint so we get
// validation messages back (the prod `sendGa4Purchase` uses the silent
// endpoint which returns 204 No Content).
const MEASUREMENT_ID =
  process.env.GA4_MEASUREMENT_ID ?? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const API_SECRET = process.env.GA4_MEASUREMENT_API_SECRET;

const TOKEN = 'ga4-self-test-2026-05-23';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const env = {
    measurementId: MEASUREMENT_ID ? `${MEASUREMENT_ID.slice(0, 8)}…` : null,
    measurementIdSet: Boolean(MEASUREMENT_ID),
    apiSecretSet: Boolean(API_SECRET),
    apiSecretLength: API_SECRET?.length ?? 0,
  };

  if (!MEASUREMENT_ID || !API_SECRET) {
    return NextResponse.json({ ok: false, env, error: 'missing env vars' }, { status: 500 });
  }

  const payload = {
    client_id: 'ga4-self-test-client',
    non_personalized_ads: false,
    events: [
      {
        name: 'purchase',
        params: {
          transaction_id: `SELF-TEST-${Date.now()}`,
          value: 1299.99,
          currency: 'USD',
          coupon: 'SELF-TEST',
          items: [
            {
              item_id: 'test-tempur-proadapt',
              item_name: 'Test — Tempur-Pedic ProAdapt (self-test)',
              item_brand: 'Tempur-Pedic',
              price: 1299.99,
              quantity: 1,
            },
          ],
        },
      },
    ],
  };

  // First: hit /debug/mp/collect to validate. Returns 200 with
  // validation_messages array; empty array = payload accepted.
  const debugUrl = `https://www.google-analytics.com/debug/mp/collect?measurement_id=${encodeURIComponent(
    MEASUREMENT_ID,
  )}&api_secret=${encodeURIComponent(API_SECRET)}`;

  let debugResult: unknown = null;
  let debugStatus = 0;
  try {
    const r = await fetch(debugUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    debugStatus = r.status;
    debugResult = await r.json();
  } catch (err) {
    return NextResponse.json(
      { ok: false, env, error: `debug call failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  // Second: hit /mp/collect to actually record the event. Returns 204.
  const collectUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
    MEASUREMENT_ID,
  )}&api_secret=${encodeURIComponent(API_SECRET)}`;

  let collectStatus = 0;
  try {
    const r = await fetch(collectUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    collectStatus = r.status;
  } catch (err) {
    return NextResponse.json(
      { ok: false, env, debugStatus, debugResult, error: `collect call failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    env,
    debug: { status: debugStatus, body: debugResult },
    collect: { status: collectStatus },
    transactionId: payload.events[0].params.transaction_id,
    note: 'Check GA4 → Reports → Realtime for a `purchase` event from client_id `ga4-self-test-client` within 30s.',
  });
}
