import assert from 'node:assert/strict';
import test from 'node:test';

let pagination = {};
try { pagination = await import('../src/pagination.mjs'); } catch {}
const paginate = pagination.paginate ?? (() => null);
const pageTokens = pagination.pageTokens ?? (() => null);
const items = Array.from({ length: 45 }, (_, index) => `q-${index + 1}`);

test('paginates twenty items with a global visible range', () => {
  assert.deepEqual(paginate(items, 2, 20), {
    items: items.slice(20, 40), page: 2, pageCount: 3, start: 20, end: 40, total: 45
  });
});

test('clamps page requests and handles exact page boundaries', () => {
  assert.equal(paginate(items.slice(0, 40), 3, 20).page, 2);
  assert.equal(paginate(items.slice(0, 40), 3, 20).pageCount, 2);
  assert.deepEqual(paginate(items, -4, 20).items, items.slice(0, 20));
});

test('represents empty results without an invalid visible range', () => {
  assert.deepEqual(paginate([], 9, 20), {
    items: [], page: 1, pageCount: 1, start: 0, end: 0, total: 0
  });
});

test('creates compact accessible page tokens near the start, middle and end', () => {
  assert.deepEqual(pageTokens(1, 3), [1, 2, 3]);
  assert.deepEqual(pageTokens(1, 20), [1, 2, 3, 4, 5, 'ellipsis', 20]);
  assert.deepEqual(pageTokens(10, 20), [1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]);
  assert.deepEqual(pageTokens(20, 20), [1, 'ellipsis', 16, 17, 18, 19, 20]);
});
