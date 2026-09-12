import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHM_RJ_ALERT_ROUTE,
  CHM_RJ_ALERT_ROUTING_CONTRACT,
  ChmRjZoneError,
  classifyChmWarningRjRouting,
} from '../src/chm-rj-zone.mjs';
import {
  ChmSourceContractError,
  validateChmWarningsHtml,
} from '../src/chm-source.mjs';

function warningsFixture(body) {
  return `<!doctype html><html lang="pt-BR"><body>
    <header>CHM Centro de Hidrografia da Marinha</header>
    <h1>Avisos de Mau Tempo</h1>
    <h2>METAREA V - avisos de mau tempo</h2>
    <p>Serviço Meteorológico Marinho: página pública oficial para consulta de avisos emitidos.</p>
    ${body}
  </body></html>`;
}

test('routes BRAVO/CHARLIE/DELTA only to the RJ regional marine scope and never municipality P0', () => {
  for (const area of ['BRAVO', 'CHARLIE', 'DELTA']) {
    const result = classifyChmWarningRjRouting({ id: `1/2026`, areas: [area] });
    assert.equal(result.route, CHM_RJ_ALERT_ROUTE.RJ_MARINE_REGIONAL);
    assert.equal(result.rjZoneCandidate, true);
    assert.deepEqual(result.directRjAreas, [area]);
    assert.equal(result.canExposeRjMarineWarning, true);
    assert.equal(result.municipalityGeofenceValidated, false);
    assert.equal(result.canPromoteMunicipalityP0, false);
    assert.equal(result.contract, CHM_RJ_ALERT_ROUTING_CONTRACT);
  }
});

test('keeps broad oceanic and outside-direct-RJ warnings out of the direct regional route', () => {
  const broad = classifyChmWarningRjRouting({ id: '2/2026', areas: ['NORTE OCEÂNICA'] });
  const outside = classifyChmWarningRjRouting({ id: '3/2026', areas: ['ECHO'] });

  assert.equal(broad.route, CHM_RJ_ALERT_ROUTE.BROAD_OCEANIC_REVIEW);
  assert.deepEqual(broad.broadOceanicAreas, ['NORTE OCEANICA']);
  assert.equal(broad.canExposeRjMarineWarning, false);
  assert.equal(outside.route, CHM_RJ_ALERT_ROUTE.NOT_DIRECT_RJ);
  assert.equal(outside.canExposeRjMarineWarning, false);
});

test('keeps warnings without an explicit CHM area unrouteable instead of inventing locality', () => {
  const result = classifyChmWarningRjRouting({ id: '4/2026', areas: [] });
  assert.equal(result.route, CHM_RJ_ALERT_ROUTE.UNROUTABLE_NO_EXPLICIT_AREA);
  assert.equal(result.rjZoneCandidate, false);
  assert.deepEqual(result.directRjAreas, []);
  assert.equal(result.canExposeRjMarineWarning, false);
  assert.equal(result.canPromoteMunicipalityP0, false);
});

test('fails closed on an unknown CHM area label', () => {
  assert.throws(
    () => classifyChmWarningRjRouting({ id: '5/2026', areas: ['INDIA'] }),
    (error) => error instanceof ChmRjZoneError && error.code === 'chm_rj_zone_unknown_area',
  );
});

test('binds regional routing into normalized CHM warning snapshots', () => {
  const snapshot = validateChmWarningsHtml(warningsFixture(`
    <p>ÁREA DELTA AVISO NR 659/2026</p>
    <p>AVISO DE MAR GROSSO</p>
    <p>EMITIDO ÀS 1230Z - TER - 08/SET/2026</p>
    <p>ONDAS DE SW 3.0/4.0 METROS.</p>
    <p>VÁLIDO ATÉ 111200Z.</p>
  `));

  assert.equal(snapshot.rjZoneRoutingValidation, CHM_RJ_ALERT_ROUTING_CONTRACT);
  assert.equal(snapshot.rjCoastGeofenceValidation, 'NOT_IMPLEMENTED');
  assert.equal(snapshot.warnings[0].rjRouting.route, CHM_RJ_ALERT_ROUTE.RJ_MARINE_REGIONAL);
  assert.deepEqual(snapshot.warnings[0].rjRouting.directRjAreas, ['DELTA']);
  assert.equal(snapshot.warnings[0].rjRouting.canExposeRjMarineWarning, true);
  assert.equal(snapshot.warnings[0].rjRouting.canPromoteMunicipalityP0, false);
  assert.match(snapshot.warningInventorySha256, /^[a-f0-9]{64}$/);
});

test('source normalization converts unknown routing labels into a source-contract failure', () => {
  assert.throws(
    () => validateChmWarningsHtml(warningsFixture(`
      <p>ÁREA INDIA AVISO NR 660/2026</p>
      <p>AVISO DE VENTO FORTE</p>
      <p>EMITIDO ÀS 1200Z - TER - 08/SET/2026</p>
      <p>VÁLIDO ATÉ 101200Z.</p>
    `)),
    (error) => error instanceof ChmSourceContractError
      && error.code === 'chm_warning_rj_routing_chm_rj_zone_unknown_area',
  );
});
