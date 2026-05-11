#!/usr/bin/env node
/**
 * SSR test orchestration — runs Next.js in dev mode and then runs the
 * node:test suite in tests/ssr/ against it.
 *
 * Phase 198: tests are intentionally HTTP-level. They fetch the rendered
 * HTML from a running `next dev` server and parse it with cheerio. They
 * cannot exercise interactive client behavior (keyboard shortcuts, focus
 * shifts, fetched products, autoplay rotation, etc.) — that requires a
 * real browser, which the dev sandbox can't install Chromium for. But
 * they CAN protect the SSR contract: structured-data emission, OG meta
 * inheritance, hero slide DOM shape, a11y attributes that ship in the
 * initial HTML, page-renders-200 smoke. Future browser-level tests can
 * be added when a Playwright-capable environment is available.
 *
 * Runs `next dev` (not `next start`) for two reasons:
 *   1. No build step needed → faster local iteration and CI cold-start.
 *   2. Production `next start` requires `next build` first, which fails
 *      to generate Shopify-dependent pages without SHOPIFY_* env vars.
 *      Dev mode JIT-renders each route on demand and 404s cleanly when
 *      Shopify isn't configured.
 */

import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const PORT = process.env.TEST_PORT ?? '3100';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const STARTUP_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 500;

/**
 * Poll the server until it responds (any HTTP status counts — we just
 * need the listener bound). Throws after STARTUP_TIMEOUT_MS.
 */
async function waitForReady() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(3000) });
      // Any response (even 500 / 404) means the server is up. We only
      // bail on connection refused.
      if (res.status) return;
    } catch {
      // not ready yet
    }
    await wait(POLL_INTERVAL_MS);
  }
  throw new Error(`Server did not become ready on ${BASE_URL} within ${STARTUP_TIMEOUT_MS}ms`);
}

const server = spawn('npx', ['next', 'dev', '--port', PORT, '--hostname', '127.0.0.1'], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
});

let serverKilled = false;
function killServer() {
  if (serverKilled) return;
  serverKilled = true;
  try {
    server.kill('SIGTERM');
  } catch {
    /* already dead */
  }
}

process.on('SIGINT', () => { killServer(); process.exit(130); });
process.on('SIGTERM', () => { killServer(); process.exit(143); });

let exitCode = 0;
try {
  await waitForReady();
  const test = spawn(
    'node',
    ['--test', '--test-reporter=spec', 'tests/ssr/**/*.test.mjs'],
    {
      stdio: 'inherit',
      env: { ...process.env, TEST_BASE_URL: BASE_URL },
    },
  );
  exitCode = await new Promise((resolve) => test.on('exit', (code) => resolve(code ?? 1)));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  exitCode = 1;
} finally {
  killServer();
}

process.exit(exitCode);
