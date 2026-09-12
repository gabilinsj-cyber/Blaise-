import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHM_WARNINGS_MAX_CACHE_AGE_MS,
  CHM_WARNINGS_SEMANTIC_VALIDITY,
  ChmWarningsCacheError,
  createChmWarningsInventoryCache,
} from '../src/chm-warning-cache.mjs';
import {
  CHM_HOST,
  CHM_SOURCE_ID,
  CHM_TEMPORAL_VALIDITY_CONTRACT,
  CHM_WARNINGS_URL,
} from '../src/chm-source.mjs';
import {
  CHM_RJ_ALERT_ROUTING_CONTRACT,
  classifyChmWarningRjRouting,
} from '../src/chm-rj-zone.mjs';

const NOW = Date.parse('2026-09-11T12:00:00.000Z');

function digestWarnings(warnings) {
  const canonical = warnings.map((warning) => ({
    id: warning.id,
    area: warning.area,
    areas: warning.areas,
    warningType: warning.warningType,
    issuedZuluClock: warning.issuedZuluClock,
    issuedAt: warning.issuedAt,
    validUntil: warning.validUntil,
    validityDurationMs: warning.validityDurationMs,
    rjRouting: warning.rjRouting,
  }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function warningSnapshot() {
  const baseWarning = {
    id: '321/2026',
    warningNumber: 321,
    year: 2026,
    area: 'ALFA',
    areas: Object.freeze(['ALFA', 'CHARLIE']),
    warningType: 'AVISO DE VENTO FORTE',
    issuedZuluClock: '1200Z',
    issuedAt: '2026-09-10T12:00:00.000Z',
    validUntil: '2026-09-12T12:00:00.000Z',
    validityDurationMs: 48 * 60 * 60 * 1000,
  };
  const warnings = Object.freeze([
    Object.freeze({
      ...baseWarning,
      rjRouting: classifyChmWarningRjRouting(baseWarning),
    }),
  ]);
  return Object.freeze({
    sourceId: CHM_SOURCE_ID,
    sourceHost: CHM_HOST,
    sourceUrl: CHM_WARNINGS_URL,
    metarea: 'V',
    activeWarningCount: warnings.length,
    noWarningMarker: false,
    warnings,
    warningInventorySha256: digestWarnings(warnings),
    rawWarningTextRetention: 'NONE',
    temporalValidityValidation: CHM_TEMPORAL_VALIDITY_CONTRACT,
    rjZoneRoutingValidation: CHM_RJ_ALERT_ROUTING_CONTRACT,
    rjCoastGeofenceValidation: 'NOT_IMPLEMENTED',
  });
}

test('CHM warnings cache is unavailable until explicitly populated', () => {
  const cache = createChmWarningsInventoryCache({ now: () => NOW });
  const reading = cache.read();
  assert.equal(reading.state, 'UNAVAILABLE');
  assert.equal(reading.reason, 'no_snapshot');
  assert.equal(reading.semanticValidity, CHM_WARNINGS_SEMANTIC_VALIDITY);
  assert.equal(reading.snapshot, null);
});

test('CHM warnings cache keeps bounded regional RJ routing without claiming municipality applicability', () => {
  const cache = createChmWarningsInventoryCache({ now: () => NOW });
  cache.recordSuccess(warningSnapshot(), { fetchedAt: NOW });
  const reading = cache.read();

  assert.equal(reading.state, 'CURRENT');
  assert.equal(reading.reason, 'fresh_source_inventory');
  assert.equal(reading.semanticValidity, 'SOURCE_INVENTORY_TEMPORAL_VALIDITY_RJ_REGIONAL_ROUTED_NOT_MUNICIPAL_GEOFENCED');
  assert.equal(reading.dataAgeMs, null);
  assert.equal(reading.cacheAgeMs, 0);
  assert.equal(reading.snapshot.activeWarningCount, 1);
  assert.deepEqual(reading.snapshot.warnings[0].areas, ['ALFA', 'CHARLIE']);
  assert.equal(reading.snapshot.warnings[0].issuedAt, '2026-09-10T12:00:00.000Z');
  assert.equal(reading.snapshot.warnings[0].validUntil, '2026-09-12T12:00:00.000Z');
  assert.equal(reading.snapshot.warnings[0].rjRouting.route, 'RJ_MARINE_REGIONAL');
  assert.deepEqual(reading.snapshot.warnings[0].rjRouting.directRjAreas, ['CHARLIE']);
  assert.equal(reading.snapshot.warnings[0].rjRouting.canExposeRjMarineWarning, true);
  assert.equal(reading.snapshot.warnings[0].rjRouting.municipalityGeofenceValidated, false);
  assert.equal(reading.snapshot.warnings[0].rjRouting.canPromoteMunicipalityP0, false);
  assert.equal(reading.snapshot.temporalValidityValidation, CHM_TEMPORAL_VALIDITY_CONTRACT);
  assert.equal(reading.snapshot.rjZoneRoutingValidation, CHM_RJ_ALERT_ROUTING_CONTRACT);
  assert.equal(reading.snapshot.rjCoastGeofenceValidation, 'NOT_IMPLEMENTED');
  assert.equal(Object.isFrozen(reading.snapshot), true);
  assert.equal(Object.isFrozen(reading.snapshot.warnings), true);
  assert.equal(Object.isFrozen(reading.snapshot.warnings[0].areas), true);
  assert.equal(Object.isFrozen(reading.snapshot.warnings[0].rjRouting), true);
});

test('CHM warnings cache becomes stale from fetch age alone', () => {
  const cache = createChmWarningsInventoryCache({ now: () => NOW });
  cache.recordSuccess(warningSnapshot(), { fetchedAt: NOW });
  const reading = cache.read({ at: NOW + CHM_WARNINGS_MAX_CACHE_AGE_MS + 1 });

  assert.equal(reading.state, 'STALE');
  assert.equal(reading.reason, 'cache_age_exceeded');
  assert.equal(reading.snapshot, null);
});

test('CHM warnings cache contains later failures and redacts stale upstream bodies', () => {
  const cache = createChmWarningsInventoryCache({ now: () => NOW });
  cache.recordSuccess(warningSnapshot(), { fetchedAt: NOW });
  cache.recordFailure('chm_warnings_source_timeout', { attemptedAt: NOW + 60_000 });
  const reading = cache.read({ at: NOW + 60_000 });

  assert.equal(reading.state, 'CURRENT_DEGRADED');
  assert.equal(reading.lastErrorCode, 'chm_warnings_source_timeout');
  assert.equal(reading.snapshot.activeWarningCount, 1);
});

test('CHM warnings cache rejects digest, area, temporal, routing and semantic drift', () => {
  const cache = createChmWarningsInventoryCache({ now: () => NOW });
  const invalidDigest = { ...warningSnapshot(), warningInventorySha256: '0'.repeat(64) };
  assert.throws(
    () => cache.recordSuccess(invalidDigest, { fetchedAt: NOW }),
    (error) => error instanceof ChmWarningsCacheError
      && error.code === 'chm_warnings_cache_digest_invalid',
  );

  const compatibilityWarnings = warningSnapshot().warnings.map((warning) => ({
    ...warning,
    area: 'CHARLIE',
  }));
  const compatibilityDrift = {
    ...warningSnapshot(),
    warnings: compatibilityWarnings,
    warningInventorySha256: digestWarnings(compatibilityWarnings),
  };
  assert.throws(
    () => cache.recordSuccess(compatibilityDrift, { fetchedAt: NOW }),
    (error) => error instanceof ChmWarningsCacheError
      && error.code === 'chm_warnings_cache_warning_area_compatibility_mismatch',
  );

  const temporalWarnings = warningSnapshot().warnings.map((warning) => ({
    ...warning,
    validUntil: '2026-10-12T12:00:00.000Z',
    validityDurationMs: 32 * 24 * 60 * 60 * 1000,
  }));
  const temporalDrift = {
    ...warningSnapshot(),
    warnings: temporalWarnings,
    warningInventorySha256: digestWarnings(temporalWarnings),
  };
  assert.throws(
    () => cache.recordSuccess(temporalDrift, { fetchedAt: NOW }),
    (error) => error instanceof ChmWarningsCacheError
      && error.code === 'chm_warnings_cache_warning_validity_window_invalid',
  );

  const routingWarnings = warningSnapshot().warnings.map((warning) => ({
    ...warning,
    rjRouting: {
      ...warning.rjRouting,
      canPromoteMunicipalityP0: true,
    },
  }));
  const routingDrift = {
    ...warningSnapshot(),
    warnings: routingWarnings,
    warningInventorySha256: digestWarnings(routingWarnings),
  };
  assert.throws(
    () => cache.recordSuccess(routingDrift, { fetchedAt: NOW }),
    (error) => error instanceof ChmWarningsCacheError
      && error.code === 'chm_warnings_cache_warning_rj_routing_invalid',
  );

  const invalidSemantics = { ...warningSnapshot(), rjZoneRoutingValidation: 'NOT_IMPLEMENTED' };
  assert.throws(
    () => cache.recordSuccess(invalidSemantics, { fetchedAt: NOW }),
    (error) => error instanceof ChmWarningsCacheError
      && error.code === 'chm_warnings_cache_semantic_contract_drift',
  );
});
