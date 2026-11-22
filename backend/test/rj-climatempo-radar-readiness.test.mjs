import test from 'node:test';
import assert from 'node:assert/strict';
import {
 RJ_CLIMATEMPO_RADAR_PLAN,assessRjClimatempoRadar
} from '../src/rj-climatempo-radar-readiness.mjs';

const now=Date.parse('2026-11-22T13:00:00Z');
const full=()=>({
 signedCommercialLicense:true,
 permissionToRenderInSubscriberApp:true,
 radarEndpointGranted:true,
 mapTilesGeoreferenced:true,
 coverage92Verified:true,
 adjacentAtlanticCoverageVerified:true,
 providerFrameTimestamp:'2026-11-22T12:58:00Z',
 backendCheckedAt:'2026-11-22T12:59:00Z',
 observedRadarType:'RADAR_REFLECTIVITY_OBSERVED',
 nowMs:now
});

test('initial Climatempo radar proposal is uncontracted, unavailable and safe',()=>{
 const result=assessRjClimatempoRadar({nowMs:now});
 assert.equal(RJ_CLIMATEMPO_RADAR_PLAN.maximumRadarFrameAgeMinutes,12);
 assert.equal(RJ_CLIMATEMPO_RADAR_PLAN.backendCollectorActive,false);
 assert.equal(RJ_CLIMATEMPO_RADAR_PLAN.permissionToEmbedOrRedistributeRadarTiles,false);
 assert.equal(result.eligibleForSeparateOperationalReview,false);
 assert.equal(result.providerCallsExecuted,false);
 assert.equal(result.publishToCustomers,false);
 assert.equal(result.weatherAlertsAuthorized,false);
 assert.equal(result.noDirectAlertaRioIngestion,true);
 assert.ok(result.blockers.includes('COMMERCIAL_RADAR_LICENSE_MISSING'));
 assert.ok(result.blockers.includes('FULL_RJ_92_COVERAGE_NOT_VERIFIED'));
});
test('even future rights and recent frames enable only separate review not provider calls',()=>{
 const result=assessRjClimatempoRadar(full());
 assert.equal(result.eligibleForSeparateOperationalReview,true);
 assert.deepEqual(result.blockers,[]);
 assert.equal(result.publishToCustomers,false);
 assert.equal(result.providerCallsExecuted,false);
});
test('outdated radar frame or missing ocean area remains blocked',()=>{
 const r=assessRjClimatempoRadar({...full(),
  providerFrameTimestamp:'2026-11-22T12:46:00Z',
  adjacentAtlanticCoverageVerified:false});
 assert.ok(r.blockers.includes('RADAR_FRAME_OR_CHECK_TOO_OLD'));
 assert.ok(r.blockers.includes('ATLANTIC_COVERAGE_NOT_VERIFIED'));
});
test('missing semantic validation cannot turn a forecast into raw radar',()=>{
 const result=assessRjClimatempoRadar({...full(),
  observedRadarType:'NOWCAST_PRECIPITATION_FORECAST'});
 assert.ok(result.blockers.includes('RADAR_PRODUCT_SEMANTICS_NOT_VERIFIED'));
 assert.equal(result.thermometersSupported,false);
});
