import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHM_RJ_MUNICIPALITY_PREFILTER_CONTRACT,
  CHM_RJ_ZONE_CONTRACT,
  CHM_RJ_ZONE_KIND,
  ChmRjZoneError,
  classifyChmRjMunicipalityCandidate,
  classifyChmRjZone,
  classifyChmWarningRjZones,
} from '../src/chm-rj-zone.mjs';

test('classifies CHM coastal areas that intersect the RJ coast without claiming municipality geofencing', () => {
  const charlie = classifyChmRjZone('CHARLIE');
  const delta = classifyChmRjZone('delta');

  assert.equal(charlie.kind, CHM_RJ_ZONE_KIND.RJ_COASTAL);
  assert.equal(charlie.officialBoundary, 'LAGUNA_TO_ARRAIAL_DO_CABO_COASTAL');
  assert.equal(charlie.rjZoneCandidate, true);
  assert.equal(delta.kind, CHM_RJ_ZONE_KIND.RJ_COASTAL);
  assert.equal(delta.officialBoundary, 'ARRAIAL_DO_CABO_TO_CARAVELAS');
  for (const item of [charlie, delta]) {
    assert.equal(item.municipalityGeofenceValidated, false);
    assert.equal(item.canPromoteMunicipalityP0, false);
    assert.equal(item.contract, CHM_RJ_ZONE_CONTRACT);
  }
});

test('classifies BRAVO as RJ-relevant offshore zone only', () => {
  const bravo = classifyChmRjZone('bravo');
  assert.equal(bravo.kind, CHM_RJ_ZONE_KIND.RJ_OFFSHORE);
  assert.equal(bravo.officialBoundary, 'LAGUNA_TO_ARRAIAL_DO_CABO_OCEANIC');
  assert.equal(bravo.rjZoneCandidate, true);
  assert.equal(bravo.canPromoteMunicipalityP0, false);
});

test('keeps non-RJ direct coastal areas and broad oceanic areas fail closed', () => {
  const alfa = classifyChmRjZone('ALFA');
  const echo = classifyChmRjZone('ECHO');
  const southOceanic = classifyChmRjZone('Sul Oceânica');

  assert.equal(alfa.kind, CHM_RJ_ZONE_KIND.OUTSIDE_DIRECT_RJ);
  assert.equal(echo.kind, CHM_RJ_ZONE_KIND.OUTSIDE_DIRECT_RJ);
  assert.equal(southOceanic.kind, CHM_RJ_ZONE_KIND.BROAD_OCEANIC);
  assert.equal(alfa.rjZoneCandidate, false);
  assert.equal(echo.rjZoneCandidate, false);
  assert.equal(southOceanic.rjZoneCandidate, false);
  assert.equal(southOceanic.canPromoteMunicipalityP0, false);
});

test('normalizes accents and rejects unknown or malformed area labels', () => {
  assert.equal(classifyChmRjZone('NORTE OCEÂNICA').area, 'NORTE OCEANICA');
  assert.throws(
    () => classifyChmRjZone('AREA INVENTADA'),
    (error) => error instanceof ChmRjZoneError && error.code === 'chm_rj_zone_unknown_area',
  );
  assert.throws(
    () => classifyChmRjZone(''),
    (error) => error instanceof ChmRjZoneError && error.code === 'chm_rj_zone_area_invalid',
  );
});

test('classifies a multi-area warning but never promotes it to municipality P0', () => {
  const result = classifyChmWarningRjZones({
    id: '700/2026',
    areas: ['ALFA', 'CHARLIE', 'DELTA'],
  });

  assert.equal(result.warningId, '700/2026');
  assert.equal(result.rjZoneCandidate, true);
  assert.equal(result.classifications.length, 3);
  assert.equal(result.municipalityGeofenceValidated, false);
  assert.equal(result.canPromoteMunicipalityP0, false);
  assert.equal(result.contract, CHM_RJ_ZONE_CONTRACT);
  assert.equal(Object.isFrozen(result.classifications), true);
});

test('rejects warning objects without a bounded explicit area inventory', () => {
  assert.throws(
    () => classifyChmWarningRjZones({ id: '701/2026', areas: [] }),
    (error) => error instanceof ChmRjZoneError && error.code === 'chm_rj_zone_warning_areas_invalid',
  );
  assert.throws(
    () => classifyChmWarningRjZones(null),
    (error) => error instanceof ChmRjZoneError && error.code === 'chm_rj_zone_warning_invalid',
  );
});

test('prefilters only IBGE sea-facing municipalities for CHM coastal zones without claiming an exact geofence', () => {
  const rio = classifyChmRjMunicipalityCandidate('CHARLIE', '3304557');
  const niteroi = classifyChmRjMunicipalityCandidate('DELTA', '3303302');

  for (const result of [rio, niteroi]) {
    assert.equal(result.ibgeSeaFacing, true);
    assert.equal(result.rjCoastalCatalogMatch, true);
    assert.equal(result.municipalityGeofenceValidated, false);
    assert.equal(result.canPromoteMunicipalityP0, false);
    assert.equal(result.contract, CHM_RJ_MUNICIPALITY_PREFILTER_CONTRACT);
  }
});

test('does not treat inland catalog entries or offshore BRAVO as municipality coastal matches', () => {
  const inland = classifyChmRjMunicipalityCandidate('CHARLIE', '3305109');
  const offshore = classifyChmRjMunicipalityCandidate('BRAVO', '3304557');

  assert.equal(inland.ibgeSeaFacing, false);
  assert.equal(inland.rjCoastalCatalogMatch, false);
  assert.equal(offshore.ibgeSeaFacing, true);
  assert.equal(offshore.kind, CHM_RJ_ZONE_KIND.RJ_OFFSHORE);
  assert.equal(offshore.rjCoastalCatalogMatch, false);
  assert.equal(offshore.canPromoteMunicipalityP0, false);
});
