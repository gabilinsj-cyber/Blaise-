import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalRjWeatherSnapshot,createRjCanonicalWeatherLedger} from '../src/rj-canonical-weather-snapshot.mjs';
const now=Date.parse('2026-10-14T15:00:00Z');
const decision={state:'TWO_INDEPENDENT_COMPARABLE_OBSERVATIONS',weighted:true,estimatedValue:28.5,
 formula:'SUM(weight*value)/SUM(weights)',selectedSources:['ALERTA_RIO','INMET_STATION'],
 measurementPair:['ALERTA_RIO','INMET_STATION'].map(sourceId=>({sourceId,ibge:'3304557',variable:'TEMPERATURA_C',type:'OBSERVED_STATION',
 observedAt:'2026-10-14T14:59:00Z',value:28,qualityWeight:1,qualityEvidenceId:'verified-qc'}))};
const input={ibge:'3304557',variable:'TEMPERATURA_C',now};
test('identity and source timestamps stay fixed across presentation clocks',()=>{
 const a=canonicalRjWeatherSnapshot(decision,input),b=canonicalRjWeatherSnapshot(decision,{...input,now:now+1000});
 assert.equal(a.snapshotId,b.snapshotId);assert.equal(a.observedAt,b.observedAt);assert.equal(a.value,28.5);
 assert.equal(a.selectedTable2Source,'INMET_STATION');assert.ok(Object.isFrozen(a.provenance));
});
test('cross city variable and multiple Table 2 selections are blocked',()=>{
 assert.throws(()=>canonicalRjWeatherSnapshot(decision,{...input,ibge:'3303302'}),/mismatch/);
 assert.throws(()=>canonicalRjWeatherSnapshot(decision,{...input,variable:'CHUVA_MM_1H'}),/mismatch/);
 assert.throws(()=>canonicalRjWeatherSnapshot({...decision,selectedSources:['ALERTA_RIO','INMET_STATION','NOAA']},input),/at_most_one/);
});
test('ledger isolates cities expires readings and performs hourly audit',()=>{
 const ledger=createRjCanonicalWeatherLedger(),s=canonicalRjWeatherSnapshot(decision,input);ledger.publish(s,now);
 assert.equal(ledger.read('3304557','TEMPERATURA_C',now),s);assert.equal(ledger.read('3303302','TEMPERATURA_C',now),null);
 assert.equal(ledger.read('3304557','TEMPERATURA_C',now+241000),null);
 assert.equal(ledger.auditHourly(now),true);assert.equal(ledger.auditHourly(now+3599999),false);assert.equal(ledger.auditHourly(now+3600000),true);
 assert.equal(ledger.audits().at(-1).reason,'HOURLY_SOURCE_DELAYED_OR_UNAVAILABLE');
});
test('unweighted context never invents an estimated measurement',()=>{
 const s=canonicalRjWeatherSnapshot({...decision,weighted:false,estimatedValue:99},input);assert.equal(s.value,null);assert.equal(s.formula,null);
});
