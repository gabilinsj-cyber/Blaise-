import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInmetCapWarningsCache,
  INMET_WARNINGS_MAX_CACHE_AGE_MS,
  INMET_WARNINGS_SEMANTIC_VALIDITY,
  InmetWarningsCacheError,
} from '../src/inmet-warning-cache.mjs';
import {
  INMET_CAP_RSS_URL,
  INMET_HOST,
  INMET_SOURCE_ID,
} from '../src/inmet-source.mjs';

const NOW = Date.parse('2026-09-11T12:00:00.000Z');

function snapshot() {
  const warning = Object.freeze({
    identifier: 'urn:oid:2.49.0.0.76.0.2026.30001.1',
    sender: 'info.aviso@inmet.gov.br',
    sent: '2026-09-11T08:50:00-03:00',
    status: 'Actual',
    msgType: 'Alert',
    event: 'Chuvas Intensas',
    urgency: 'Expected',
    severity: 'Severe',
    certainty: 'Likely',
    onset: '2026-09-11T09:00:00-03:00',
    expires: '2026-09-11T18:00:00-03:00',
    areaCount: 1,
    areaDescriptions: Object.freeze(['Rio de Janeiro']),
    affectsRioDeJaneiro: true,
    rjMatchMethod: 'CAP_GEOCODE_IBGE_33',
    rjMunicipalityIbges: Object.freeze(['3304557']),
  });
  const warnings = Object.freeze([warning]);
  const canonical = warnings.map((record) => ({
    identifier: record.identifier,
    sent: record.sent,
    event: record.event,
    urgency: record.urgency,
    severity: record.severity,
    certainty: record.certainty,
    onset: record.onset,
    expires: record.expires,
    areaDescriptions: record.areaDescriptions,
    rjMatchMethod: record.rjMatchMethod,
    rjMunicipalityIbges: record.rjMunicipalityIbges,
  }));
  return Object.freeze({
    sourceId: INMET_SOURCE_ID,
    sourceHost: INMET_HOST,
    sourceUrl: INMET_CAP_RSS_URL,
    feedShape: 'CAP_ALERT',
    activeWarningCount: 1,
    rjWarningCount: 1,
    warnings,
    rjWarnings: warnings,
    warningInventorySha256: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
    identityValidation: 'INMET_SENDER_DOMAIN+OFFICIAL_OID_PREFIX',
    temporalValidityValidation: 'BOUNDED_CAP_ONSET_EXPIRES_MAX_7D',
    rjGeofenceValidation: 'CAP_CANONICAL_IBGE33_OR_BR_RJ_OR_AREA_DESC',
    polygonRetention: 'NONE',
    rawFeedRetention: 'NONE',
  });
}

test('stores a validated INMET CAP inventory in memory without implying P0 publication', () => {
  const cache = createInmetCapWarningsCache({ now: () => NOW });
  const source = snapshot();
  cache.recordSuccess(source, { fetchedAt: NOW });

  const reading = cache.read({ at: NOW + 5 * 60 * 1000, mode: 'normal' });
  assert.equal(reading.state, 'CURRENT');
  assert.equal(reading.semanticValidity, INMET_WARNINGS_SEMANTIC_VALIDITY);
  assert.equal(reading.snapshot.rjWarningCount, 1);
  assert.equal(reading.snapshot.rjWarnings[0].severity, 'Severe');
  assert.equal(Object.isFrozen(reading.snapshot), true);
  assert.equal(Object.isFrozen(reading.snapshot.warnings), true);
});

test('fails closed when the canonical warning digest drifts', () => {
  const cache = createInmetCapWarningsCache({ now: () => NOW });
  const source = structuredClone(snapshot());
  source.warningInventorySha256 = '0'.repeat(64);
  assert.throws(
    () => cache.recordSuccess(source, { fetchedAt: NOW }),
    (error) => error instanceof InmetWarningsCacheError
      && error.code === 'inmet_warnings_cache_digest_invalid',
  );
});

test('fails closed when RJ warning inventory diverges from the canonical warning list', () => {
  const cache = createInmetCapWarningsCache({ now: () => NOW });
  const source = structuredClone(snapshot());
  source.rjWarnings = [];
  source.rjWarningCount = 0;
  assert.throws(
    () => cache.recordSuccess(source, { fetchedAt: NOW }),
    (error) => error instanceof InmetWarningsCacheError
      && error.code === 'inmet_warnings_cache_rj_inventory_mismatch',
  );
});

test('expires cached inventory independently from CAP warning validity', () => {
  const cache = createInmetCapWarningsCache({ now: () => NOW });
  cache.recordSuccess(snapshot(), { fetchedAt: NOW });

  const reading = cache.read({ at: NOW + INMET_WARNINGS_MAX_CACHE_AGE_MS + 1, mode: 'normal' });
  assert.equal(reading.state, 'STALE');
  assert.equal(reading.reason, 'cache_age_exceeded');
  assert.equal(reading.snapshot, null);
  assert.equal(reading.semanticValidity, INMET_WARNINGS_SEMANTIC_VALIDITY);
});

test('preserves a current snapshot as degraded after a later bounded refresh failure', () => {
  let clock = NOW;
  const cache = createInmetCapWarningsCache({ now: () => clock });
  cache.recordSuccess(snapshot(), { fetchedAt: NOW });
  clock += 60_000;
  cache.recordFailure('inmet_source_timeout', { attemptedAt: clock });

  const reading = cache.read({ at: clock, mode: 'severe' });
  assert.equal(reading.state, 'CURRENT_DEGRADED');
  assert.equal(reading.lastErrorCode, 'inmet_source_timeout');
  assert.equal(reading.snapshot.rjWarningCount, 1);
});
