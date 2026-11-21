import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_METEOROLOGICAL_SOURCE_AUDIT,assessRjMeteorologicalProductionReadiness}
 from '../src/rj-meteorological-production-readiness.mjs';
import {RJ_SOURCE_SECTOR_MATRIX,RJ_SOURCE_MATRIX_POLICY}
 from '../src/rj-source-sector-matrix.mjs';

test('every documented sector is inventoried and sources never claim customer approval',()=>{
 const report=assessRjMeteorologicalProductionReadiness();
 assert.equal(report.reviewedSourceCount,19);
 assert.equal(report.sourceAudit.length,19);
 assert.equal(report.sectorCount,RJ_SOURCE_SECTOR_MATRIX.length);
 assert.equal(report.missingSectors.length,0);
 assert.equal(report.excludedSourcesActive.length,0);
 assert.equal(report.policyIntegrityPass,true);
 assert.equal(report.status,'BLOCKED_EXTERNAL_EVIDENCE_REQUIRED');
 assert.ok(report.sourceAudit.every(x=>x.productionEvidence==='NOT_ESTABLISHED'));
 assert.ok(report.sourceAudit.every(x=>x.clientPublicationAuthorized===false&&x.blockers.length>0));
 assert.equal(report.meteorologicalProductionHomologated,false);
 assert.equal(report.publishNewMeteorologicalSourcesToClients,false);
 assert.equal(report.allowNewAutomaticCollection,false);
 assert.equal(report.allowSafetyCriticalAlertsFromUnverifiedSources,false);
});
test('removed sources are not reactivated through the sector registry',()=>{
 const banned=new Set(RJ_SOURCE_MATRIX_POLICY.expresslyExcludedDirectSources);
 const ids=RJ_SOURCE_SECTOR_MATRIX.flatMap(x=>x.products.map(p=>p.sourceId));
 assert.equal(ids.some(x=>banned.has(x)),false);
 assert.equal(RJ_SOURCE_MATRIX_POLICY.automaticCollection,false);
 assert.equal(RJ_SOURCE_MATRIX_POLICY.publishedToAndroid,false);
 assert.equal(RJ_SOURCE_MATRIX_POLICY.notLiveCollection,true);
 assert.equal(RJ_SOURCE_MATRIX_POLICY.marineSstValidatedLive,false);
 assert.ok(banned.has('WINDY'));
 assert.ok(banned.has('EUMETSAT'));
 assert.ok(banned.has('INEA'));
 assert.ok(banned.has('JAXA_GSMAP'));
});
test('known real one-time experiments do not turn into 92-city or live coverage',()=>{
 const state=assessRjMeteorologicalProductionReadiness();
 for(const id of ['METEOBLUE_FREE_BASIC6H','VISUAL_CROSSING_FREE',
  'DWD_ICON_92','NOAA_GOES19_GLM','NOAA_GFS_WAVE','NOAA_COASTWATCH_SST']){
  const x=state.sourceAudit.find(x=>x.id===id);
  assert.ok(x,id);
  assert.equal(x.clientPublicationAuthorized,false,id);
  assert.ok(x.blockers.some(b=>/COVERAGE|CURRENT|92|ATTRIBUTION|REVIEW|LICENSE|LIVE|RELEASE|SECRET|KEY|DATA/.test(b)),id);
 }
 const mb=state.sourceAudit.find(x=>x.id==='METEOBLUE_FREE_BASIC6H');
 assert.ok(mb.blockers.some(x=>/CONVECTIVE/.test(x)));
 assert.ok(mb.blockers.some(x=>/REDISTRIBUTION/.test(x)));
 assert.ok(mb.blockers.some(x=>/EXPOSED/.test(x)));
});
test('HG Brasil remains unpurchased and WeatherAPI remains a candidate',()=>{
 const a=assessRjMeteorologicalProductionReadiness();
 const hg=a.sourceAudit.find(x=>x.id==='HG_BRASIL_PRO');
 const w=a.sourceAudit.find(x=>x.id==='WEATHERAPI_FREE');
 const o=a.sourceAudit.find(x=>x.id==='OPENWEATHER_AGENT13');
 assert.ok(hg.blockers.includes('PAID_PLAN_NOT_CONTRACTED_BY_DESIGN'));
 assert.ok(w.blockers.includes('NO_ACCOUNT_KEY_OR_REAL_PROVIDER_RESPONSE'));
 assert.ok(o.blockers.includes('KEY_LICENSE_FRESHNESS_AND_OPERATOR_APPROVAL'));
 assert.equal(a.noPaidPlans,true);
 assert.equal(a.noProviderNetworkCalls,true);
 assert.equal(a.noCreditReservations,true);
 assert.equal(a.noDeployment,true);
});
test('scientific, licensing, alert and operational gates stay explicit',()=>{
 const x=assessRjMeteorologicalProductionReadiness();
 const y=x.requiredExternalGates;
 assert.ok(y.includes('PROVIDER_PRODUCT_BY_PRODUCT_LIVE_FRESHNESS_AND_RJ_COVERAGE'));
 assert.ok(y.includes('PROVIDER_LICENCE_ATTRIBUTION_REPRODUCTION_RIGHTS'));
 assert.ok(y.includes('P0_SAFETY_REAL_ALERT_DELIVERY_AND_FALSE_POSITIVE_TEST'));
 assert.ok(y.includes('PERFORMANCE_CANARY_ROLLBACK_OBSERVABILITY'));
 assert.ok(y.includes('SEPARATE_HUMAN_PRODUCTION_RELEASE_AUTHORIZATION'));
 assert.ok(RJ_METEOROLOGICAL_SOURCE_AUDIT.every(x=>Object.isFrozen(x)));
});

test('live one-run DWD/NOAA proof is separate from SST unavailability and continuous service',()=>{
 const x=assessRjMeteorologicalProductionReadiness();
 const dwd=x.sourceAudit.find(s=>s.id==='DWD_ICON_92');
 const waves=x.sourceAudit.find(s=>s.id==='NOAA_GFS_WAVE');
 const glm=x.sourceAudit.find(s=>s.id==='NOAA_GOES19_GLM');
 const sst=x.sourceAudit.find(s=>s.id==='NOAA_COASTWATCH_SST');
 assert.ok(dwd.evidence.includes('ONE_REAL_DWD'));
 assert.ok(dwd.evidence.includes('92_OF_92'));
 assert.ok(dwd.blockers.some(v=>v.includes('OFFICIAL_CDO_GRID_WEIGHTS')));
 assert.ok(waves.evidence.includes('ONE_REAL_NOAA'));
 assert.ok(glm.evidence.includes('ZERO_RJ_RECTANGLE'));
 assert.ok(sst.evidence.includes('NO_RECENT_FILE_ZERO_VERIFIED'));
 assert.equal(sst.clientPublicationAuthorized,false);
 assert.equal(dwd.productionEvidence,'NOT_ESTABLISHED');
 assert.equal(waves.productionEvidence,'NOT_ESTABLISHED');
 assert.equal(glm.productionEvidence,'NOT_ESTABLISHED');
});
