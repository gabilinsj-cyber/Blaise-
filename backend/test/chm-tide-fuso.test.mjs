import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bindChmTideFusoToken,
  CHM_TIDE_CIVIL_CLOCK_BINDING,
  CHM_TIDE_FUSO_CONTRACT,
  CHM_TIDE_FUSO_SIGN_CONVENTION,
  CHM_TIDE_FUSO_TIME_BASIS,
  ChmTideFusoError,
} from '../src/chm-tide-fuso.mjs';

test('binds DHN positive-west FUSO +3 to base UTC offset -180 minutes', () => {
  const result = bindChmTideFusoToken('+3');
  assert.equal(result.rawToken, '+3');
  assert.equal(result.zoneHoursWest, 3);
  assert.equal(result.baseUtcOffsetMinutes, -180);
  assert.equal(result.signConvention, CHM_TIDE_FUSO_SIGN_CONVENTION);
  assert.equal(result.timeBasis, CHM_TIDE_FUSO_TIME_BASIS);
  assert.equal(result.civilClockAdjustmentMinutes, null);
  assert.equal(result.effectiveUtcOffsetMinutes, null);
  assert.equal(result.civilClockBinding, CHM_TIDE_CIVIL_CLOCK_BINDING);
  assert.equal(result.contract, CHM_TIDE_FUSO_CONTRACT);
});

test('binds east-of-Greenwich negative DHN FUSO to positive UTC offset', () => {
  const result = bindChmTideFusoToken('-2');
  assert.equal(result.zoneHoursWest, -2);
  assert.equal(result.baseUtcOffsetMinutes, 120);
});

test('binds Greenwich FUSO zero without inventing a civil-clock adjustment', () => {
  const result = bindChmTideFusoToken('0');
  assert.equal(result.zoneHoursWest, 0);
  assert.equal(result.baseUtcOffsetMinutes, 0);
  assert.equal(result.effectiveUtcOffsetMinutes, null);
});

for (const token of ['+03:00', '3.5', 'abc', '', '++3']) {
  test(`fails closed on malformed FUSO token ${JSON.stringify(token)}`, () => {
    assert.throws(
      () => bindChmTideFusoToken(token),
      (error) => error instanceof ChmTideFusoError && error.code === 'chm_tide_fuso_token_invalid',
    );
  });
}

for (const token of ['+15', '-15']) {
  test(`fails closed on out-of-range FUSO token ${token}`, () => {
    assert.throws(
      () => bindChmTideFusoToken(token),
      (error) => error instanceof ChmTideFusoError && error.code === 'chm_tide_fuso_range_invalid',
    );
  });
}

test('fails closed on non-string input instead of coercing it', () => {
  assert.throws(
    () => bindChmTideFusoToken(3),
    (error) => error instanceof ChmTideFusoError && error.code === 'chm_tide_fuso_token_invalid',
  );
});
