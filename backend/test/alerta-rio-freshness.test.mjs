import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertAlertaRioLiveFreshness,
  OfficialSourceContractError,
} from '../src/alerta-rio-source.mjs';

const NOW = new Date('2026-09-26T18:00:00.000Z');

function snapshot(oldestObservedAt, freshestObservedAt) {
  return Object.freeze({ oldestObservedAt, freshestObservedAt });
}

test('accepts a fresh Alerta Rio snapshot', () => {
  const value = snapshot('2026-09-26T17:45:00.000Z', '2026-09-26T17:55:00.000Z');
  assert.equal(assertAlertaRioLiveFreshness(value, { now: NOW }), value);
});

test('fails closed for stale Alerta Rio snapshot', () => {
  const value = snapshot('2026-09-26T17:20:00.000Z', '2026-09-26T17:30:00.000Z');
  assert.throws(
    () => assertAlertaRioLiveFreshness(value, { now: NOW }),
    (error) => error instanceof OfficialSourceContractError && error.code === 'alerta_rio_live_stale_snapshot',
  );
});

test('fails closed for future Alerta Rio timestamp', () => {
  const value = snapshot('2026-09-26T18:03:00.000Z', '2026-09-26T18:04:00.000Z');
  assert.throws(
    () => assertAlertaRioLiveFreshness(value, { now: NOW }),
    (error) => error instanceof OfficialSourceContractError && error.code === 'alerta_rio_live_future_timestamp',
  );
});

test('fails closed for invalid snapshot timestamps', () => {
  const value = snapshot('invalid', 'invalid');
  assert.throws(
    () => assertAlertaRioLiveFreshness(value, { now: NOW }),
    (error) => error instanceof OfficialSourceContractError && error.code === 'alerta_rio_live_invalid_snapshot_timestamp',
  );
});
