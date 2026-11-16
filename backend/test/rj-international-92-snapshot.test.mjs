import test from 'node:test';
import assert from 'node:assert/strict';
import {
 RJ_INTERNATIONAL_92_CONTRACT, buildRjInternational92Snapshot,
} from '../src/rj-international-92-snapshot.mjs';
const now=Date.parse('2026-11-16T15:00:00Z');
const row={
 ibge:'3304557',status:'AVAILABLE_PROVIDER_CURRENT_ESTIMATE',
 sourceId:'OPENWEATHER_ONECALL4_CURRENT',
 type:'PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_MEASUREMENT',
 attributionRequired:true,originalMapPreserved:true,
 officialObservation:false,officialAlert:false,radarFrame:false,
 latitude:-22.9068,longitude:-43.1729,
 validAt:'2026-11-16T14:55:00.000Z',
 retrievedAt:'2026-11-16T14:56:00.000Z',
 values:{temperatureC:27.4,providerFeelsLikeC:31,relativeHumidityPct:79,
   windKmh:14.4,gustKmh:23,rainMm1h:null,pressureHpa:1012},
 rawSecret:'not_allowed_in_output',
};
const build=(rows,rest={})=>buildRjInternational92Snapshot({
 providerRows:rows,nowMs:now,licenseUseConfirmed:true,...rest
});
test('a real licensed international record updates only its own RJ municipality',()=>{
 const x=build([row]);
 assert.equal(x.contract,RJ_INTERNATIONAL_92_CONTRACT);
 assert.equal(x.totalMunicipalities,92);
 assert.equal(x.municipalities.length,92);
 assert.equal(x.currentMunicipalities,1);
 const city=x.municipalities.find(v=>v.ibge==='3304557');
 assert.equal(city.status,'CURRENT_MODELED_ESTIMATE');
 assert.equal(city.weather.values.temperatureC,27.4);
 assert.equal(city.weather.values.feelsLikeC,31);
 assert.equal(city.weather.values.rainMm1h,null);
 assert.equal(city.weather.type,'MODELED_CURRENT_ESTIMATE');
 assert.equal(x.municipalities.filter(v=>v.status==='NO_CURRENT_INTERNATIONAL_DATA').length,91);
 assert.ok(!JSON.stringify(x).includes('not_allowed_in_output'));
});
test('license use not confirmed blocks the whole publication',()=>{
 assert.equal(buildRjInternational92Snapshot({providerRows:[row],nowMs:now}),null);
});
test('stale, shifted, non-provider or Brazilian readings are never published',()=>{
 const bad=[
  {...row,validAt:'2026-11-16T14:00:00.000Z'},
  {...row,latitude:-21.0,longitude:-52.0},
  {...row,status:'CURRENT'},
  {...row,type:'OBSERVATION'},
  {...row,sourceId:'ALERTA_RIO'},
  {...row,officialObservation:true},
  {...row,values:{...row.values,temperatureC:9999}},
 ];
 for (const v of bad){
   const snap=build([v]);
   assert.equal(snap.currentMunicipalities,0);
 }
});
test('invalid source numeric values become null, not false zero',()=>{
 const x=build([{...row,values:{...row.values,rainMm1h:9999,gustKmh:-2}}]);
 const v=x.municipalities.find(v=>v.ibge==='3304557').weather.values;
 assert.equal(v.rainMm1h,null);
 assert.equal(v.gustKmh,null);
});
test('duplicate provider values only preserve the most recent genuine valid timestamp',()=>{
 const x=build([{...row,validAt:'2026-11-16T14:50:00Z',values:{...row.values,temperatureC:19}},row]);
 assert.equal(x.currentMunicipalities,1);
 assert.equal(x.municipalities.find(v=>v.ibge==='3304557').weather.values.temperatureC,27.4);
});
test('no current verified provider values still render 92 known municipalities without fake temperatures',()=>{
 const x=build([]);
 assert.equal(x.currentMunicipalities,0);
 assert.ok(x.municipalities.every(r=>r.weather===null));
 assert.equal(x.radarAvailable,false);
 assert.equal(x.warningsIssuedByThisFeed,false);
});
test('max 92 upstream rows protects from uncontrolled application fanout',()=>{
 const values=Array.from({length:93},()=>row);
 assert.equal(build(values),null);
});
