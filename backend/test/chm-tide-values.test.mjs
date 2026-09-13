import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHM_TIDE_TIME_BASIS,
  CHM_TIDE_VALUE_CONTRACT,
  ChmTideValueError,
  normalizeChmTideValues,
} from '../src/chm-tide-values.mjs';

function baseInput() {
  return {
    station: {
      stationNumber: 40,
      name: 'PORTO DO RIO DE JANEIRO - I FISCAL',
      pageStart: 130,
      pageEnd: 132,
    },
    calendarYear: 2026,
    timeBasis: CHM_TIDE_TIME_BASIS,
    utcOffsetMinutes: -180,
    sourceArtifactSha256: 'a'.repeat(64),
    predictions: [
      { localDate: '2026-09-13', localTime: '03:30', heightMeters: 1.2, phase: 'PM', sourcePage: 130 },
      { localDate: '2026-09-13', localTime: '10:41', heightMeters: 0.4, phase: 'BM', sourcePage: 130 },
      { localDate: '2026-09-13', localTime: '15:23', heightMeters: 1.1, phase: 'HIGH', sourcePage: 130 },
      { localDate: '2026-09-13', localTime: '22:45', heightMeters: 0.2, phase: 'LOW', sourcePage: 130 },
    ],
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof ChmTideValueError && error.code === code);
}

test('normalizes structured CHM tide values without inferring source semantics', () => {
  const result = normalizeChmTideValues(baseInput());
  assert.equal(result.sourceId, 'chm-marine');
  assert.equal(result.contract, CHM_TIDE_VALUE_CONTRACT);
  assert.equal(result.predictionCount, 4);
  assert.equal(result.firstLocalDate, '2026-09-13');
  assert.equal(result.lastLocalDate, '2026-09-13');
  assert.equal(result.predictions[0].phase, 'HIGH');
  assert.equal(result.predictions[1].phase, 'LOW');
  assert.equal(result.predictions[0].instantUtc, '2026-09-13T06:30:00.000Z');
  assert.equal(result.phaseDerivation, 'EXPLICIT_ONLY_NO_INFERENCE');
  assert.equal(result.rawSourceTextRetention, 'NONE');
  assert.equal(result.liveSourceExtraction, 'BLOCKED_OFFICIAL_PDF_VALUE_EXTRACTION_NOT_EVIDENCED');
  assert.match(result.tideValueSha256, /^[0-9a-f]{64}$/);
});

test('canonical digest is independent of input prediction order', () => {
  const first = baseInput();
  const second = baseInput();
  second.predictions.reverse();
  const a = normalizeChmTideValues(first);
  const b = normalizeChmTideValues(second);
  assert.equal(a.tideValueSha256, b.tideValueSha256);
  assert.deepEqual(a.predictions, b.predictions);
});

test('accepts absent phase only as explicit no-inference state', () => {
  const input = baseInput();
  input.predictions = [{ localDate: '2026-01-02', localTime: '05:00', heightMeters: 0.7, phase: null, sourcePage: 131 }];
  const result = normalizeChmTideValues(input);
  assert.equal(result.predictions[0].phase, null);
  assert.equal(result.predictions[0].phaseSource, 'NOT_PROVIDED_NO_INFERENCE');
});

test('rejects date outside the catalog year', () => {
  const input = baseInput();
  input.predictions[0] = { ...input.predictions[0], localDate: '2025-09-13' };
  expectCode(() => normalizeChmTideValues(input), 'chm_tide_value_date_year_mismatch');
});

test('rejects impossible calendar dates', () => {
  const input = baseInput();
  input.predictions[0] = { ...input.predictions[0], localDate: '2026-02-29' };
  expectCode(() => normalizeChmTideValues(input), 'chm_tide_value_local_date_invalid');
});

test('rejects duplicate local date/time entries', () => {
  const input = baseInput();
  input.predictions.push({ ...input.predictions[0], heightMeters: 1.3 });
  expectCode(() => normalizeChmTideValues(input), 'chm_tide_value_duplicate_local_time');
});

test('rejects values attributed to a page outside the official station range', () => {
  const input = baseInput();
  input.predictions[0] = { ...input.predictions[0], sourcePage: 133 };
  expectCode(() => normalizeChmTideValues(input), 'chm_tide_value_source_page_invalid');
});

test('rejects more than eight tide events for one local date', () => {
  const input = baseInput();
  input.predictions = Array.from({ length: 9 }, (_, index) => ({
    localDate: '2026-03-04',
    localTime: `${String(index).padStart(2, '0')}:00`,
    heightMeters: 0.5 + (index / 10),
    phase: null,
    sourcePage: 130,
  }));
  expectCode(() => normalizeChmTideValues(input), 'chm_tide_value_daily_count_invalid');
});

test('rejects malformed source artifact digests', () => {
  const input = baseInput();
  input.sourceArtifactSha256 = 'not-a-digest';
  expectCode(() => normalizeChmTideValues(input), 'chm_tide_value_source_sha256_invalid');
});

test('rejects unproven time basis and invalid explicit phases', () => {
  const wrongBasis = baseInput();
  wrongBasis.timeBasis = 'ASSUMED_LOCAL_TIME';
  expectCode(() => normalizeChmTideValues(wrongBasis), 'chm_tide_value_time_basis_invalid');

  const wrongPhase = baseInput();
  wrongPhase.predictions[0] = { ...wrongPhase.predictions[0], phase: 'RISING' };
  expectCode(() => normalizeChmTideValues(wrongPhase), 'chm_tide_value_phase_invalid');
});

test('rejects implausible heights and UTC offsets fail-closed', () => {
  const wrongHeight = baseInput();
  wrongHeight.predictions[0] = { ...wrongHeight.predictions[0], heightMeters: 99 };
  expectCode(() => normalizeChmTideValues(wrongHeight), 'chm_tide_value_height_invalid');

  const wrongOffset = baseInput();
  wrongOffset.utcOffsetMinutes = 2000;
  expectCode(() => normalizeChmTideValues(wrongOffset), 'chm_tide_value_utc_offset_invalid');
});
