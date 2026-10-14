import test from 'node:test';
import assert from 'node:assert/strict';
import { rjAlertActiveUntil, rjAlertIsActive, rjAlertRetainHistory } from '../src/rj-alert-retention.mjs';
const issued = '2026-10-14T12:00:00Z';
const start = Date.parse(issued);
const longExpiry = '2026-10-17T12:00:00Z';
test('12h cutoff is based on official emission, not current download time', () => {
  assert.equal(rjAlertActiveUntil(issued, longExpiry), start + 43_200_000);
  assert.equal(rjAlertIsActive(issued, longExpiry, start + 43_199_999), true);
  assert.equal(rjAlertIsActive(issued, longExpiry, start + 43_200_000), false);
});
test('history is removed at exactly 12h after local expiration', () => {
  assert.equal(rjAlertRetainHistory(issued, longExpiry, start + 86_399_999), true);
  assert.equal(rjAlertRetainHistory(issued, longExpiry, start + 86_400_000), false);
});
test('earlier official expiry starts the historical retention earlier', () => {
  const early = '2026-10-14T14:00:00Z';
  assert.equal(rjAlertActiveUntil(issued, early), Date.parse(early));
  assert.equal(rjAlertRetainHistory(issued, early, Date.parse(early) + 43_200_000), false);
});
test('a genuine new official emission renews local lifetime', () => {
  const updated = '2026-10-14T20:00:00Z';
  const now = start + 13 * 3_600_000;
  assert.equal(rjAlertIsActive(issued, longExpiry, now), false);
  assert.equal(rjAlertIsActive(updated, longExpiry, now), true);
});
test('invalid timestamps and future emission cannot present an active warning', () => {
  assert.equal(rjAlertIsActive(issued, longExpiry, start - 1), false);
  assert.equal(rjAlertRetainHistory('bad', longExpiry, start), false);
  assert.equal(rjAlertActiveUntil(issued, issued), null);
});
