import test from 'node:test';
import assert from 'node:assert/strict';

import { CHM_EXPLICIT_MARINE_SIGNAL_CONTRACT } from '../src/chm-marine-signal.mjs';
import { ChmSourceContractError, validateChmWarningsHtml } from '../src/chm-source.mjs';

function fixture(body) {
  return `<!doctype html><html lang="pt-BR"><body>
    <header>CHM Centro de Hidrografia da Marinha</header>
    <h1>Avisos de Mau Tempo</h1>
    <h2>METAREA V - avisos de mau tempo</h2>
    <p>Serviço Meteorológico Marinho: página pública oficial para consulta de avisos emitidos.</p>
    ${body}
  </body></html>`;
}

test('binds an explicit CHM wave range into normalized warning and RJ regional routing', () => {
  const snapshot = validateChmWarningsHtml(fixture(`
    <p>ÁREA DELTA AVISO NR 659/2026</p>
    <p>AVISO DE MAR GROSSO</p>
    <p>EMITIDO ÀS 1230Z - TER - 08/SET/2026</p>
    <p>ONDAS DE SW 3.0/4.0 METROS.</p>
    <p>VÁLIDO ATÉ 111200Z.</p>
  `));

  const warning = snapshot.warnings[0];
  assert.equal(warning.marineSignal.explicitWaveHeight, true);
  assert.equal(warning.marineSignal.waveDirection, 'SW');
  assert.equal(warning.marineSignal.waveMinMeters, 3);
  assert.equal(warning.marineSignal.waveMaxMeters, 4);
  assert.equal(warning.marineSignal.waveHeightThresholdExceeded, true);
  assert.equal(warning.marineSignal.officialRessacaLabel, false);
  assert.equal(warning.marineSignal.canPromoteMunicipalityP0, false);
  assert.equal(warning.marineSignal.contract, CHM_EXPLICIT_MARINE_SIGNAL_CONTRACT);
  assert.deepEqual(warning.rjRouting.marineSignal, warning.marineSignal);
  assert.equal(warning.rjRouting.route, 'RJ_MARINE_REGIONAL');
  assert.equal(warning.rjRouting.canPromoteMunicipalityP0, false);
});

test('does not infer official ressaca merely from a wave range above 3.5 m', () => {
  const snapshot = validateChmWarningsHtml(fixture(`
    <p>ÁREA CHARLIE AVISO NR 660/2026</p>
    <p>AVISO DE MAR GROSSO</p>
    <p>EMITIDO ÀS 1200Z - QUI - 10/SET/2026</p>
    <p>ONDAS DE S 4.0/5.0 METROS.</p>
    <p>VÁLIDO ATÉ 121200Z.</p>
  `));
  assert.equal(snapshot.warnings[0].marineSignal.waveHeightThresholdExceeded, true);
  assert.equal(snapshot.warnings[0].marineSignal.officialRessacaLabel, false);
});

test('marks official ressaca only when the CHM warning type explicitly says RESSACA', () => {
  const snapshot = validateChmWarningsHtml(fixture(`
    <p>ÁREA CHARLIE AVISO NR 661/2026</p>
    <p>AVISO DE RESSACA</p>
    <p>EMITIDO ÀS 1200Z - QUI - 10/SET/2026</p>
    <p>ONDAS DE S 2.5/3.0 METROS.</p>
    <p>VÁLIDO ATÉ 121200Z.</p>
  `));
  assert.equal(snapshot.warnings[0].marineSignal.officialRessacaLabel, true);
  assert.equal(snapshot.warnings[0].marineSignal.waveHeightThresholdExceeded, false);
});

test('compatible duplicate renderings preserve one explicit wave signal', () => {
  const snapshot = validateChmWarningsHtml(fixture(`
    <p>AVISO NR 662/2026</p>
    <p>AVISO DE MAR GROSSO</p>
    <p>EMITIDO ÀS 1200Z - QUI - 10/SET/2026</p>
    <p>VÁLIDO ATÉ 121200Z.</p>
    <p>ÁREA CHARLIE AVISO NR 662/2026</p>
    <p>AVISO DE MAR GROSSO</p>
    <p>EMITIDO ÀS 1200Z - QUI - 10/SET/2026</p>
    <p>ONDAS DE SW 3.0/4.0 METROS.</p>
    <p>VÁLIDO ATÉ 121200Z.</p>
  `));
  assert.equal(snapshot.activeWarningCount, 1);
  assert.equal(snapshot.duplicateRenderCount, 1);
  assert.equal(snapshot.warnings[0].marineSignal.explicitWaveHeight, true);
  assert.equal(snapshot.warnings[0].marineSignal.waveMaxMeters, 4);
});

test('conflicting duplicate explicit wave signals fail source normalization closed', () => {
  assert.throws(
    () => validateChmWarningsHtml(fixture(`
      <p>ÁREA CHARLIE AVISO NR 663/2026</p>
      <p>AVISO DE MAR GROSSO</p>
      <p>EMITIDO ÀS 1200Z - QUI - 10/SET/2026</p>
      <p>ONDAS DE SW 3.0/4.0 METROS.</p>
      <p>VÁLIDO ATÉ 121200Z.</p>
      <p>ÁREA CHARLIE AVISO NR 663/2026</p>
      <p>AVISO DE MAR GROSSO</p>
      <p>EMITIDO ÀS 1200Z - QUI - 10/SET/2026</p>
      <p>ONDAS DE S 3.0/4.0 METROS.</p>
      <p>VÁLIDO ATÉ 121200Z.</p>
    `)),
    (error) => error instanceof ChmSourceContractError
      && error.code === 'chm_warning_marine_signal_chm_marine_signal_duplicate_conflict',
  );
});

test('malformed explicit wave text fails closed instead of being dropped or guessed', () => {
  assert.throws(
    () => validateChmWarningsHtml(fixture(`
      <p>ÁREA DELTA AVISO NR 664/2026</p>
      <p>AVISO DE MAR GROSSO</p>
      <p>EMITIDO ÀS 1200Z - QUI - 10/SET/2026</p>
      <p>ONDAS DE SW QUATRO METROS.</p>
      <p>VÁLIDO ATÉ 121200Z.</p>
    `)),
    (error) => error instanceof ChmSourceContractError
      && error.code === 'chm_warning_marine_signal_chm_marine_signal_wave_expression_ambiguous',
  );
});
