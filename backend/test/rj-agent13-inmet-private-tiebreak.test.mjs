import test from 'node:test';
import assert from 'node:assert/strict';
import {
 reviewAgent13ConflictWithInmet,fingerprintRjInmetDispute,RJ_INMET_PANEL_URL,
 RJ_INMET_TIEBREAK_AUTO_FETCH,RJ_INMET_TIEBREAK_CLIENT_PUBLICATION
} from '../src/rj-agent13-inmet-private-tiebreak.mjs';
import {auditAgent13Minute} from '../src/rj-agent13-freshness-supervisor.mjs';

const NOW=Date.parse('2026-11-22T15:15:00.000Z');
const row=(sourceId,value,at='2026-11-22T15:00:00.000Z')=>({
 ibge:'3304557',regionId:null,field:'temperatureC',
 sourceId,nature:'E',value,measuredAt:at,
 ingestedAt:'2026-11-22T15:10:00.000Z',
 providerPublishedAt:null,
 verifiedByBackend:true,municipalityMappingVerified:true,
 originalProviderTimestampVerified:true,qualityPass:true,
 wasIngestedFromAuthorizedCollector:true
});
const a=row('VISUAL_CROSSING_FREE',24);
const b=row('WEATHERAPI_FREE',30,'2026-11-22T15:05:00.000Z');
const evidence=()=>({
 accessMode:'HUMAN_VERIFIED_PUBLIC_INMET_PANEL',
 publicPanelUrl:RJ_INMET_PANEL_URL,
 inspectedByAuthorizedReviewer:true,officialInmetStationVerified:true,
 stationRepresentativeForTargetArea:true,geographyAndAltitudeVerified:true,
 sameMeteorologicalVariableAndUnitsVerified:true,
 originalObservationTimeVerified:true,referenceQualityApproved:true,
 targetIbge:'3304557',targetRegionId:null,
 parameter:'temperatureC',conflictFingerprint:fingerprintRjInmetDispute([a,b]),stationCode:'A601',stationDistanceKm:8,
 observedValue:25,observedAt:'2026-11-22T15:00:00.000Z',
 reviewedAt:'2026-11-22T15:14:00.000Z'
});
const enable={
 VISUAL_CROSSING_FREE:{
  licensed:true,collectingAuthorized:true,
  clientReleaseAuthorized:true,serverVerified:true
 },
 WEATHERAPI_FREE:{
  licensed:true,collectingAuthorized:true,
  clientReleaseAuthorized:true,serverVerified:true
 }
};
test('only after Blaise conflict, INMET chooses closer Blaise value, never discloses INMET value or station',()=>{
 const out=auditAgent13Minute({nowMs:NOW,rows:[a,b],enabledSources:enable,
  privateInmetReviews:{'3304557:ALL:temperatureC':evidence()}
 });
 assert.equal(out.privateInmetReviewAttemptedCount,1);
 assert.equal(out.resolvedByPrivateInmetCount,1);
 assert.equal(out.heldForConflictCount,0);
 assert.equal(out.proposedUpdates.length,1);
 assert.equal(out.proposedUpdates[0].value,24);
 assert.equal(out.proposedUpdates[0].sourceId,'VISUAL_CROSSING_FREE');
 assert.equal(out.proposedUpdates[0].measuredAt,a.measuredAt);
 assert.equal(out.inmetMeasurementsInClientData,false);
 assert.equal(out.providerNetworkCalls,0);
 assert.equal(out.automaticClientPublication,false);
 assert.equal(JSON.stringify(out).includes('A601'),false);
 assert.equal(JSON.stringify(out).includes('observedValue'),false);
 assert.equal(JSON.stringify(out).includes('mapas.inmet'),false);
});
test('INMET review is not consulted if there is no independent conflict',()=>{
 const out=auditAgent13Minute({nowMs:NOW,rows:[a,row('WEATHERAPI_FREE',25)],
  enabledSources:enable,privateInmetReviews:{
   '3304557:ALL:temperatureC':evidence()
  }});
 assert.equal(out.privateInmetReviewAttemptedCount,0);
 assert.equal(out.resolvedByPrivateInmetCount,0);
 assert.equal(out.proposedUpdates.length,1);
});
test('outdated, mismatched geography and unverified INMET public panel fail closed',()=>{
 for(const review of [
  {...evidence(),observedAt:'2026-11-22T12:00:00.000Z'},
  {...evidence(),targetIbge:'3303302'},
  {...evidence(),stationDistanceKm:150},
  {...evidence(),geographyAndAltitudeVerified:false},
  {...evidence(),inspectedByAuthorizedReviewer:false},
  {...evidence(),publicPanelUrl:'https://inmet-other.example/'},
  {...evidence(),sameMeteorologicalVariableAndUnitsVerified:false},
  {...evidence(),reviewedAt:'2026-11-22T14:50:00.000Z'},
  {...evidence(),observedValue:45}
 ]){
  const out=reviewAgent13ConflictWithInmet({
   ibge:'3304557',regionId:null,field:'temperatureC',
   candidates:[a,b],review,nowMs:NOW
  });
  assert.equal(out.status,'REVIEW_REQUIRED');
  assert.equal(out.selectedBlaiseReading,null);
  assert.equal(out.inmetValueExposed,false);
 }
});
test('private INMET review cannot replay on a changed Blaise conflict',()=>{
 const altered={...b,value:34};
 const out=reviewAgent13ConflictWithInmet({
  ibge:'3304557',regionId:null,field:'temperatureC',
  candidates:[a,altered],review:evidence(),nowMs:NOW
 });
 assert.equal(out.status,'REVIEW_REQUIRED');
 assert.equal(out.selectedBlaiseReading,null);
 assert.equal(out.inmetValueExposed,false);
});
test('equal distance and differences too large from INMET do not force selection',()=>{
 for(const review of [{...evidence(),observedValue:27},
                      {...evidence(),observedValue:50}]){
  const out=reviewAgent13ConflictWithInmet({
   ibge:'3304557',regionId:null,field:'temperatureC',
   candidates:[a,b],review,nowMs:NOW
  });
  assert.equal(out.status,'REVIEW_REQUIRED');
 }
});
test('station temperature must not arbitrate feels-like, sky state or forecast',()=>{
 for(const field of ['feelsLikeC','skyCondition','forecastTemperatureC']){
  const out=reviewAgent13ConflictWithInmet({
   ibge:'3304557',regionId:null,field,candidates:[a,b],review:evidence(),nowMs:NOW
  });
  assert.equal(out.status,'REVIEW_REQUIRED');
 }
 assert.equal(RJ_INMET_TIEBREAK_AUTO_FETCH,false);
 assert.equal(RJ_INMET_TIEBREAK_CLIENT_PUBLICATION,false);
});
test('unreviewed conflict still held and never publishes, despite candidate freshness',()=>{
 const out=auditAgent13Minute({nowMs:NOW,rows:[a,b],enabledSources:enable});
 assert.equal(out.heldForConflictCount,1);
 assert.equal(out.proposedUpdates.length,0);
 assert.equal(out.privateInmetReviewAttemptedCount,0);
});
