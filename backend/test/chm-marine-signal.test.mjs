import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHM_EXPLICIT_MARINE_SIGNAL_CONTRACT,
  CHM_RESSACA_WAVE_THRESHOLD_METERS,
  ChmMarineSignalError,
  mergeChmMarineSignals,
  parseChmMarineSignal,
  validateChmMarineSignal,
} from '../src/chm-marine-signal.mjs';

test('parses an explicit CHM wave range and preserves direction without calling it ressaca', () => {
  const signal = parseChmMarineSignal(
    'AVISO DE MAR GROSSO ONDAS DE SW 3.0/4.0 METROS. VÁLIDO ATÉ 111200Z.',
    'AVISO DE MAR GROSSO',
  );

  assert.equal(signal.explicitWaveHeight, true);
  assert.equal(signal.waveDirection, 'SW');
  assert.equal(signal.waveMinMeters, 3);
  assert.equal(signal.waveMaxMeters, 4);
  assert.equal(signal.waveThresholdMeters, CHM_RESSACA_WAVE_THRESHOLD_METERS);
  assert.equal(signal.waveHeightThresholdExceeded, true);
  assert.equal(signal.officialRessacaLabel, false);
  assert.equal(signal.canPromoteMunicipalityP0, false);
  assert.equal(signal.contract, CHM_EXPLICIT_MARINE_SIGNAL_CONTRACT);
});

test('accepts decimal comma and a single explicit wave height', () => {
  const signal = parseChmMarineSignal('ONDAS DE ESE 3,5 METROS.', 'AVISO DE MAR GROSSO');
  assert.equal(signal.waveDirection, 'ESE');
  assert.equal(signal.waveMinMeters, 3.5);
  assert.equal(signal.waveMaxMeters, 3.5);
  assert.equal(signal.waveHeightThresholdExceeded, false);
});

test('official ressaca label comes only from the warning type', () => {
  const signal = parseChmMarineSignal('ONDAS DE S 2.0/2.5 METROS.', 'AVISO DE RESSACA');
  assert.equal(signal.officialRessacaLabel, true);
  assert.equal(signal.waveHeightThresholdExceeded, false);
});

test('returns a bounded null wave signal when the warning has no explicit wave line', () => {
  const signal = parseChmMarineSignal('VENTO SW FORÇA 7.', 'AVISO DE VENTO FORTE');
  assert.equal(signal.explicitWaveHeight, false);
  assert.equal(signal.waveDirection, null);
  assert.equal(signal.waveMinMeters, null);
  assert.equal(signal.waveMaxMeters, null);
  assert.equal(signal.waveHeightThresholdExceeded, null);
  assert.equal(signal.officialRessacaLabel, false);
});

test('fails closed on malformed, descending or implausible explicit wave ranges', () => {
  for (const body of [
    'ONDAS DE SW QUATRO METROS.',
    'ONDAS DE SW 5.0/3.0 METROS.',
    'ONDAS DE SW 3.0/31.0 METROS.',
    'ONDAS DE XYZ 3.0/4.0 METROS.',
  ]) {
    assert.throws(
      () => parseChmMarineSignal(body, 'AVISO DE MAR GROSSO'),
      (error) => error instanceof ChmMarineSignalError,
    );
  }
});

test('duplicate render merge keeps one explicit signal and rejects conflicting explicit signals', () => {
  const empty = parseChmMarineSignal('VENTO SW FORÇA 7.', 'AVISO DE MAR GROSSO');
  const explicit = parseChmMarineSignal('ONDAS DE SW 3.0/4.0 METROS.', 'AVISO DE MAR GROSSO');
  const merged = mergeChmMarineSignals(empty, explicit, 'AVISO DE MAR GROSSO');
  assert.equal(merged.explicitWaveHeight, true);
  assert.equal(merged.waveMaxMeters, 4);

  const conflicting = parseChmMarineSignal('ONDAS DE S 3.0/4.0 METROS.', 'AVISO DE MAR GROSSO');
  assert.throws(
    () => mergeChmMarineSignals(explicit, conflicting, 'AVISO DE MAR GROSSO'),
    (error) => error instanceof ChmMarineSignalError
      && error.code === 'chm_marine_signal_duplicate_conflict',
  );
});

test('cache-facing validator recomputes threshold semantics and rejects tampering', () => {
  const signal = parseChmMarineSignal('ONDAS DE SW 3.0/4.0 METROS.', 'AVISO DE MAR GROSSO');
  assert.deepEqual(validateChmMarineSignal(signal, 'AVISO DE MAR GROSSO'), signal);
  assert.throws(
    () => validateChmMarineSignal({ ...signal, waveHeightThresholdExceeded: false }, 'AVISO DE MAR GROSSO'),
    (error) => error instanceof ChmMarineSignalError,
  );
});
