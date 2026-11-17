import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RJ_HG_BRASIL_PRO_PLAN as plan,
  checkRjHgBrasilProReadiness as ready
} from '../src/rj-hgbrasil-pro-plan.mjs';

test('HG Pro plan covers exactly 92 RJ municipality ids within 100-city ceiling',()=>{
  assert.equal(plan.municipalityCount,92);
  assert.equal(plan.cityLimit,100);
  assert.equal(plan.targetCityCodes.length,92);
  assert.equal(new Set(plan.targetCityCodes).size,92);
  assert.ok(plan.targetCityCodes.includes('3304557'));
  assert.equal(plan.pollingIntervalMinutes,60);
  assert.equal(plan.pollsPerCityPerDay,24);
  assert.equal(plan.plannedCallsPerDay,92*24);
  assert.equal(plan.plannedCallsPer30Days,92*24*30);
  assert.equal(plan.dailyRequestLimit,20_000);
  assert.equal(plan.remainingDailyRequestsWithoutRetries,20_000-2208);
  assert.equal(plan.displayedMonthlyPriceBrl,49.9);
});
test('HG paid app publication is blocked on explicit commercial rights and purchase',()=>{
  assert.equal(ready().readyForManuallyReviewedCollector,false);
  assert.ok(ready().reasons.includes('PAID_PLAN_NOT_ACTIVE'));
  assert.ok(ready().reasons.includes('WRITTEN_COMMERCIAL_GRANT_REQUIRED'));
  assert.equal(plan.subscriptionActive,false);
  assert.equal(plan.scheduledPollingEnabled,false);
  assert.equal(plan.liveIngestionConfirmed,false);
  assert.equal(plan.publishedToAndroid,false);
  assert.equal(plan.secretsEmbeddedInAndroid,false);
  assert.equal(plan.useIpGeolocation,false);
  assert.equal(plan.measurementOrigin,'THIRD_PARTY_AGGREGATED_UNVERIFIED');
  assert.equal(plan.rainfallObservationsLicensedAndValidated,false);
  assert.equal(plan.stationSensorProof,false);
  assert.ok(!plan.permittedCandidateFields.includes('rainNowMm'));
  assert.ok(!plan.permittedCandidateFields.includes('rainAccumulatedMm'));
});
test('all readiness prerequisites must be explicit and no call is initiated by the gate',()=>{
  const all={subscriptionActive:true,writtenCommercialGrantVerified:true,
    termsAcceptedByOperator:true,serverSecretConfigured:true,
    providerCityMapValidated:true,municipalityCount:92,preparedForRelease:true};
  assert.equal(ready({...all,municipalityCount:50}).readyForManuallyReviewedCollector,false);
  assert.equal(ready({...all,writtenCommercialGrantVerified:false}).readyForManuallyReviewedCollector,false);
  const pass=ready(all);
  assert.equal(pass.readyForManuallyReviewedCollector,true);
  assert.equal(pass.automaticCollection,false);
  assert.equal(pass.customerPublication,false);
  assert.equal(pass.independentStationMeasurementsConfirmed,false);
});
