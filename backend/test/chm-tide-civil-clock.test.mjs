import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bindChmTideCivilClock,
  CHM_TIDE_CIVIL_CLOCK_BINDING,
  CHM_TIDE_CIVIL_CLOCK_CONTRACT,
  CHM_TIDE_CIVIL_CLOCK_POLICY,
  CHM_TIDE_CIVIL_CLOCK_SNAPSHOT_DATE,
  ChmTideCivilClockError,
} from '../src/chm-tide-civil-clock.mjs';

test('binds RJ 2026 civil clock to the evidenced -03:00 legal time with no DST adjustment', () => {
  const result = bindChmTideCivilClock({ calendarYear: 2026, baseUtcOffsetMinutes: -180 });
  assert.equal(result.calendarYear, 2026);
  assert.equal(result.baseUtcOffsetMinutes, -180);
  assert.equal(result.civilClockAdjustmentMinutes, 0);
  assert.equal(result.effectiveUtcOffsetMinutes, -180);
  assert.equal(result.civilClockBinding, CHM_TIDE_CIVIL_CLOCK_BINDING);
  assert.equal(result.policy, CHM_TIDE_CIVIL_CLOCK_POLICY);
  assert.equal(result.policySnapshotDate, CHM_TIDE_CIVIL_CLOCK_SNAPSHOT_DATE);
  assert.equal(result.contract, CHM_TIDE_CIVIL_CLOCK_CONTRACT);
  assert.ok(result.evidence.some((url) => url.includes('d9772.htm')));
  assert.ok(result.evidence.some((url) => url.includes('horario-de-verao')));
  assert.ok(result.evidence.some((url) => url.includes('hora-falada-on')));
});

test('fails closed for a calendar year whose civil-clock policy has not been evidenced', () => {
  assert.throws(
    () => bindChmTideCivilClock({ calendarYear: 2027, baseUtcOffsetMinutes: -180 }),
    (error) => error instanceof ChmTideCivilClockError
      && error.code === 'chm_tide_civil_clock_year_not_evidenced',
  );
});

test('fails closed when the CHM base offset disagrees with the evidenced RJ 2026 legal-time offset', () => {
  assert.throws(
    () => bindChmTideCivilClock({ calendarYear: 2026, baseUtcOffsetMinutes: -120 }),
    (error) => error instanceof ChmTideCivilClockError
      && error.code === 'chm_tide_civil_clock_base_offset_mismatch',
  );
});

test('fails closed on malformed civil-clock input', () => {
  assert.throws(
    () => bindChmTideCivilClock(null),
    (error) => error instanceof ChmTideCivilClockError
      && error.code === 'chm_tide_civil_clock_input_invalid',
  );
});
