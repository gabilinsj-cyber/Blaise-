import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCAL_RJ_PRECEDENCE,
  SOUTH_AMERICA_SOURCES,
  WIS2_GLOBAL_BROKERS,
  buildSouthAmericaLayerSnapshot,
  classifySouthAmericaRecord,
  deduplicateSouthAmericaRecords,
  getSouthAmericaSource,
  normalizeSouthAmericaRecord,
} from '../src/south-america-meteorology.mjs';

test('registers the requested South America / WMO AR-III sources', () => {
  const ids = new Set(SOUTH_AMERICA_SOURCES.map((source) => source.id));
  assert.equal(ids.has('wmo-wis2-ar-smn-synop'), true);
  assert.equal(ids.has('wmo-wis2-uy-inumet-synop'), true);
  assert.equal(ids.has('wmo-wis2-uy-inumet-cap'), true);
  assert.equal(ids.has('ecmwf-ifs-open'), true);
  assert.equal(ids.has('noaa-gfs-0p25'), true);

  assert.equal(getSouthAmericaSource('wmo-wis2-ar-smn-synop').centreId, 'ar-smn');
  assert.equal(getSouthAmericaSource('wmo-wis2-uy-inumet-synop').centreId, 'uy-inumet');
  assert.equal(getSouthAmericaSource('ecmwf-ifs-open').centreId, 'int-ecmwf');
});

test('keeps multiple operational WIS2 brokers for transport failover', () => {
  assert.equal(WIS2_GLOBAL_BROKERS.length >= 4, true);
  assert.equal(new Set(WIS2_GLOBAL_BROKERS.map((broker) => broker.id)).size, WIS2_GLOBAL_BROKERS.length);
  assert.equal(WIS2_GLOBAL_BROKERS.every((broker) => broker.endpoint.startsWith('mqtts://')), true);
});

test('normalizes WIS2 provenance and rejects an unknown broker', () => {
  const record = normalizeSouthAmericaRecord({
    sourceId: 'wmo-wis2-ar-smn-synop',
    canonicalKey: 'surface:station-87576:temperature:2026-09-14T20:00Z',
    originRecordId: 'urn:wmo:example:ar-smn:87576:20260914T2000Z',
    effectiveAtMillis: 1_789_416_000_000,
    receivedAtMillis: 1_789_416_060_000,
    brokerId: 'br-inmet-global-broker',
  });
  assert.equal(record.centreId, 'ar-smn');
  assert.equal(record.brokerId, 'br-inmet-global-broker');

  assert.throws(() => normalizeSouthAmericaRecord({
    ...record,
    brokerId: 'unknown-broker',
  }), /invalid_wis2_broker/);
});

test('deduplicates the same WIS2 origin record mirrored by multiple global brokers', () => {
  const base = {
    sourceId: 'wmo-wis2-uy-inumet-synop',
    canonicalKey: 'surface:86460:pressure:2026-09-14T20:00Z',
    originRecordId: 'urn:wmo:example:uy-inumet:86460:20260914T2000Z',
    effectiveAtMillis: 1_789_416_000_000,
    receivedAtMillis: 1_789_416_060_000,
  };
  const deduplicated = deduplicateSouthAmericaRecords([
    { ...base, brokerId: 'cn-cma-global-broker' },
    { ...base, brokerId: 'br-inmet-global-broker', receivedAtMillis: 1_789_416_120_000 },
  ]);
  assert.equal(deduplicated.length, 1);
  assert.equal(deduplicated[0].brokerId, 'br-inmet-global-broker');
});

test('classifies stale, expired and future records fail-closed', () => {
  const now = 1_789_416_000_000;
  const base = {
    sourceId: 'wmo-wis2-ar-smn-synop',
    canonicalKey: 'surface:test:temperature',
    originRecordId: 'origin-1',
    receivedAtMillis: now,
  };

  assert.equal(classifySouthAmericaRecord({ ...base, effectiveAtMillis: now - 60_000 }, { nowMillis: now }), 'FRESH');
  assert.equal(classifySouthAmericaRecord({ ...base, effectiveAtMillis: now - 3 * 60 * 60 * 1000 }, { nowMillis: now }), 'STALE');
  assert.equal(classifySouthAmericaRecord({ ...base, effectiveAtMillis: now - 60_000, validUntilMillis: now - 1 }, { nowMillis: now }), 'EXPIRED');
  assert.equal(classifySouthAmericaRecord({ ...base, effectiveAtMillis: now + 6 * 60 * 1000 }, { nowMillis: now }), 'FUTURE');
});

test('reconciles a canonical field by authority while preserving model alternates', () => {
  const now = 1_789_416_000_000;
  const canonicalKey = 'forecast:south-cone:rj-upstream:mslp:2026-09-15T00Z';
  const snapshot = buildSouthAmericaLayerSnapshot([
    {
      sourceId: 'noaa-gfs-0p25',
      canonicalKey,
      originRecordId: 'gfs-20260914-18-f006',
      effectiveAtMillis: now - 30_000,
      receivedAtMillis: now - 20_000,
    },
    {
      sourceId: 'ecmwf-ifs-open',
      canonicalKey,
      originRecordId: 'ecmwf-20260914-18-f006',
      effectiveAtMillis: now - 40_000,
      receivedAtMillis: now - 10_000,
    },
  ], { nowMillis: now });

  assert.equal(snapshot.reconciled[canonicalKey].preferred.sourceId, 'ecmwf-ifs-open');
  assert.equal(snapshot.reconciled[canonicalKey].alternates.length, 1);
  assert.equal(snapshot.reconciled[canonicalKey].alternates[0].sourceId, 'noaa-gfs-0p25');
});

test('South America layer can never override local RJ official decisions', () => {
  assert.equal(LOCAL_RJ_PRECEDENCE.mayOverrideLocalRjOfficialAlert, false);
  assert.equal(LOCAL_RJ_PRECEDENCE.mayOverrideLocalRjOfficialObservation, false);
  assert.equal(LOCAL_RJ_PRECEDENCE.modelGuidanceCanBecomeP0, false);
});
