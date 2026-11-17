import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RJ_OUTSIDE_OBSERVATION_CANDIDATES as networks,
  RJ_OBSERVATION_INTEGRATION_GATE as gate,
} from '../src/rj-observation-network-candidates.mjs';

test('all proposed networks remain research only, not live production measurements',()=>{
  assert.equal(networks.length,4);
  assert.equal(new Set(networks.map(n=>n.id)).size,4);
  assert.deepEqual(networks.map(n=>n.id),[
    'WEATHER_UNDERGROUND_PWS','AMBIENT_WEATHER_NETWORK','WEATHERCLOUD','ZOOM_EARTH'
  ]);
  assert.ok(networks.every(n=>!n.writtenCommercialPermissionVerified &&
    !n.sourceCredentialsVerified && !n.activeRjStationInventoryVerified &&
    !n.liveIngestionConfirmed && !n.publishedToSubscribers));
  assert.equal(gate.currentCandidateCountForLiveProduction,0);
  assert.equal(gate.automaticNetworkPolling,false);
  assert.equal(gate.publishToClient,false);
});

test('online maps and visual viewers cannot be treated as permitted numeric sources',()=>{
  const byId=id=>networks.find(n=>n.id===id);
  assert.equal(byId('WEATHERCLOUD').transport,'NO_OFFICIAL_RETRIEVAL_API');
  assert.equal(byId('ZOOM_EARTH').transport,'PERSONAL_NON_COMMERCIAL_VIEWER');
  for(const id of ['WEATHERCLOUD','ZOOM_EARTH'])
    assert.equal(byId(id).measurementKinds.length,0);
  assert.ok(byId('WEATHER_UNDERGROUND_PWS').restrictions.includes(
    'COMMERCIAL_WRITTEN_AGREEMENT_REQUIRED'));
  assert.ok(byId('AMBIENT_WEATHER_NETWORK').restrictions.includes(
    'PUBLIC_STATION_MAP_IS_NOT_BLANKET_API_CONSENT'));
});

test('municipal station and 30-minute ground-rain safeguards remain mandatory',()=>{
  assert.equal(gate.rainfallObservationMaximumAgeMinutes,30);
  assert.equal(gate.actualStationMeasurementsOnly,true);
  assert.equal(gate.requireSensorInventoryAndQualityControl,true);
  assert.equal(gate.requireCrossPlatformHardwareDeduplication,true);
  assert.equal(gate.requirePerMunicipalityEvidenceFor92Cities,true);
  assert.equal(gate.derivedFieldsMustNotBeLabeledDirectSensorObservations,true);
  assert.equal(gate.missingValue,'UNAVAILABLE');
});
