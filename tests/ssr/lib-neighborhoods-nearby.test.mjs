/**
 * Unit tests for getNearbyNeighborhoods (lib/neighborhoods.ts) — the
 * sibling cross-link helper that powers the "Nearby neighborhoods" block
 * on the neighborhood page template.
 *
 * No dev server needed — pure lib import via Node strip-types. The module
 * only pulls in lib/showrooms.ts (no @/ path aliases), so it loads in a
 * plain node:test run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { NEIGHBORHOODS, getNearbyNeighborhoods, findNeighborhood } = await import(
  '../../lib/neighborhoods.ts'
);

test('returns siblings sharing a showroom, excluding self', () => {
  // Sherman Oaks → Studio City only; siblings are the other Studio City areas.
  const shermanOaks = findNeighborhood('mattress-store-sherman-oaks');
  const nearby = getNearbyNeighborhoods(shermanOaks);
  assert.ok(nearby.length > 0, 'expected at least one sibling');
  assert.ok(
    !nearby.some((n) => n.handle === shermanOaks.handle),
    'must not include itself',
  );
  for (const n of nearby) {
    assert.ok(
      n.nearestShowroomHandles.some((h) => shermanOaks.nearestShowroomHandles.includes(h)),
      `${n.handle} should share a showroom with sherman-oaks`,
    );
  }
});

test('respects the limit argument', () => {
  const burbank = findNeighborhood('mattress-store-burbank');
  // Burbank covers two showrooms, so it has many siblings — cap at 3.
  const capped = getNearbyNeighborhoods(burbank, 3);
  assert.ok(capped.length <= 3, `expected <= 3, got ${capped.length}`);
});

test('preserves NEIGHBORHOODS ordering', () => {
  const burbank = findNeighborhood('mattress-store-burbank');
  const nearby = getNearbyNeighborhoods(burbank, 50);
  const order = NEIGHBORHOODS.map((n) => n.handle);
  const indices = nearby.map((n) => order.indexOf(n.handle));
  const sorted = [...indices].sort((a, b) => a - b);
  assert.deepEqual(indices, sorted, 'siblings should follow NEIGHBORHOODS order');
});

test('every neighborhood links to at least one sibling (no orphan in the cluster)', () => {
  for (const n of NEIGHBORHOODS) {
    const nearby = getNearbyNeighborhoods(n);
    assert.ok(
      nearby.length > 0,
      `${n.handle} has no sibling neighborhoods — it would render an isolated page`,
    );
  }
});
