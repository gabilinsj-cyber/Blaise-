import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestLimiter } from '../src/blaise-shield-rj.mjs';

test('Blaise Shield RJ limits requests and resets expired windows', () => {
  const check = createRequestLimiter({
    limit: 2,
    windowMs: 1000,
    maxEntries: 2
  });

  assert.equal(check('a', 0).allowed, true);
  assert.equal(check('a', 100).allowed, true);
  assert.equal(check('a', 200).allowed, false);
  assert.equal(check('b', 200).allowed, true);
  assert.equal(check('c', 200).allowed, false);
  assert.equal(check('c', 1001).allowed, true);
  assert.equal(check('a', 1001).allowed, false);
  assert.equal(check('', 1001).allowed, false);
});

test('Blaise Shield RJ rejects invalid configuration', () => {
  assert.throws(
    () => createRequestLimiter({ limit: 0 }),
    RangeError
  );
  assert.throws(
    () => createRequestLimiter({ windowMs: -1 }),
    RangeError
  );
  assert.throws(
    () => createRequestLimiter({ maxEntries: 0 }),
    RangeError
  );
});
