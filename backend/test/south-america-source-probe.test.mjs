import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SOUTH_AMERICA_SOURCES,
  WIS2_GLOBAL_BROKERS,
} from '../src/south-america-meteorology.mjs';
import {
  buildSouthAmericaSourceProbePlan,
  probeSouthAmericaSourceAvailability,
  validateSouthAmericaSourceRegistry,
} from '../src/south-america-source-probe.mjs';

function bodyFor(sourceId) {
  switch (sourceId) {
    case 'wmo-wis2-ar-smn-synop':
      return 'urn:wmo:md:ar-smn:slt0ci cache/a/wis2/ar-smn/data/core/weather/surface-based-observations/synop';
    case 'wmo-wis2-uy-inumet-synop':
      return 'urn:wmo:md:uy-inumet:surface-based-observations.synop origin/a/wis2/uy-inumet/data/core/weather/surface-based-observations/synop';
    case 'wmo-wis2-uy-inumet-cap':
      return 'urn:wmo:md:uy-inumet:cap-alerts origin/a/wis2/uy-inumet/data/core/weather/advisories-warnings';
    case 'ecmwf-ifs-open':
      return 'OpenECPDS <a href="20260914/">20260914/</a><a href="20260915/">20260915/</a>';
    case 'noaa-gfs-0p25':
      return 'NOMADS NCEP GFS Forecasts gfs.20260914 gfs.20260915';
    default:
      throw new Error(`unexpected source ${sourceId}`);
  }
}

test('South America source registry is secure and retains two independent model sources', () => {
  const result = validateSouthAmericaSourceRegistry();
  assert.equal(result.status, 'PASS');
  assert.equal(result.sourceCount, 5);
  assert.equal(result.wis2SourceCount, 3);
  assert.equal(result.modelSourceCount, 2);
  assert.equal(result.brokerCount, 4);

  const noaa = WIS2_GLOBAL_BROKERS.find((broker) => broker.id === 'us-noaa-global-broker');
  assert.ok(noaa);
  assert.equal(new URL(noaa.endpoint).hostname, 'wis2globalbroker.nws.noaa.gov');
  assert.equal(new URL(noaa.endpoint).protocol, 'mqtts:');
});

test('probe plan covers every registered source and uses only HTTPS endpoints', () => {
  const plan = buildSouthAmericaSourceProbePlan();
  assert.equal(plan.length, SOUTH_AMERICA_SOURCES.length);
  assert.deepEqual(new Set(plan.map((item) => item.sourceId)), new Set(SOUTH_AMERICA_SOURCES.map((item) => item.id)));
  for (const item of plan) {
    assert.equal(new URL(item.url).protocol, 'https:');
    assert.ok(item.expectedMarkers.length >= 1);
  }
});

test('availability probe proves discovery/model listing contracts without claiming ingestion', async () => {
  const plan = buildSouthAmericaSourceProbePlan();
  const sourceIdByUrl = new Map(plan.map((item) => [item.url, item.sourceId]));
  const fetchImpl = async (url) => {
    const sourceId = sourceIdByUrl.get(url);
    assert.ok(sourceId, `unexpected URL ${url}`);
    return new Response(bodyFor(sourceId), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  };

  const evidence = await probeSouthAmericaSourceAvailability({
    fetchImpl,
    nowMillis: Date.UTC(2026, 8, 15, 6, 45, 0),
  });

  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.httpAvailability.length, 5);
  assert.ok(evidence.httpAvailability.every((item) => item.status === 'PASS'));
  assert.equal(evidence.mqttLiveSubscription, 'NOT_IMPLEMENTED_NO_MQTT_CLIENT');
  assert.equal(evidence.numericalForecastIngestion, 'NOT_IMPLEMENTED_AVAILABILITY_ONLY');
  assert.equal(evidence.productionForecastIngestion, 'NOT_PROVEN');
  assert.equal(evidence.canTriggerP0, false);

  const ecmwf = evidence.httpAvailability.find((item) => item.sourceId === 'ecmwf-ifs-open');
  const noaa = evidence.httpAvailability.find((item) => item.sourceId === 'noaa-gfs-0p25');
  assert.equal(ecmwf.latestRunToken, '20260915');
  assert.equal(noaa.latestRunToken, '20260915');
});

test('availability probe fails closed when a source contract marker disappears', async () => {
  const plan = buildSouthAmericaSourceProbePlan();
  const sourceIdByUrl = new Map(plan.map((item) => [item.url, item.sourceId]));
  const fetchImpl = async (url) => {
    const sourceId = sourceIdByUrl.get(url);
    if (sourceId === 'noaa-gfs-0p25') return new Response('unexpected page', { status: 200 });
    return new Response(bodyFor(sourceId), { status: 200 });
  };

  const evidence = await probeSouthAmericaSourceAvailability({ fetchImpl, nowMillis: 1_789_446_300_000 });
  assert.equal(evidence.status, 'FAIL');
  const noaa = evidence.httpAvailability.find((item) => item.sourceId === 'noaa-gfs-0p25');
  assert.equal(noaa.status, 'FAIL');
  assert.equal(noaa.errorCode, 'probe_contract_marker_missing');
  assert.equal(evidence.productionForecastIngestion, 'NOT_PROVEN');
});
