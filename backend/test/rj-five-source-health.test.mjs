import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRjFiveSourceHealth,RJ_FIVE_SOURCE_HEALTH_CONTRACT} from '../src/rj-five-source-health.mjs';
import {
  ALERTA_RIO_RAINFALL_TASK_ID,INMET_WARNINGS_TASK_ID,
  DEFESA_CIVIL_RIO_ASSETS_TASK_ID,
} from '../src/official-source-worker.mjs';

const now=Date.parse('2026-10-10T22:00:00Z');
const stamp=new Date(now-60_000).toISOString();
function sourceWorker({running=true,stale=false,onlyWarnings=false}={}){
  const data={
    [ALERTA_RIO_RAINFALL_TASK_ID]:{state:stale?'STALE':'CURRENT',
      fetchedAt:stale?new Date(now-60*60_000).toISOString():stamp,
      observedAt:stamp,snapshot:{sourceId:'alerta-rio-rainfall-live',stations:[]}},
    [INMET_WARNINGS_TASK_ID]:{state:'CURRENT',fetchedAt:stamp,observedAt:stamp,
      snapshot:{sourceId:'inmet-cap-warnings',rjWarnings:[]}},
    [DEFESA_CIVIL_RIO_ASSETS_TASK_ID]:{state:'CURRENT',
      fetchedAt:stamp,snapshot:{sourceId:'defesa-civil-rio-map-assets',sirens:[]}},
  };
  return {
    status(){return {enabled:running,started:running};},
    readSource(id){return onlyWarnings&&id!==INMET_WARNINGS_TASK_ID?null:data[id]??null;},
  };
}
test('five distinct providers show only verified product scope, never all 92 city feeds',()=>{
  const result=buildRjFiveSourceHealth(sourceWorker(),{nowMillis:now});
  assert.equal(result.contract,RJ_FIVE_SOURCE_HEALTH_CONTRACT);
  assert.equal(result.sources.length,5);
  assert.deepEqual(result.sources.map(x=>x.id),[
    'alerta-rio','defesa-civil','inmet','inpe-cptec','windy']);
  assert.equal(result.sources[0].status,'CURRENT_PRODUCT_ONLY');
  assert.equal(result.sources[0].product,'CHUVA_REDE_DE_ESTACOES');
  assert.equal(result.sources[1].product,'ATIVOS_GEOGRAFICOS_SIRENES_E_APOIO');
  assert.equal(result.sources[2].product,'AVISOS_CAP');
  assert.equal(result.sources[3].status,'NOT_CONNECTED');
  assert.equal(result.sources[4].status,'NOT_CONNECTED');
  assert.equal(result.sources.every(x=>!x.provenRealTimeFor92Cities),true);
  assert.equal(result.sources.every(x=>!x.temperatureServiceConnected),true);
  assert.equal(result.sources.every(x=>!x.radarFramesConnected),true);
  assert.equal(result.fiveSimultaneousLiveFeedsConfirmed,false);
  assert.equal(result.weatherRadarSpatialFramesConfirmed,false);
  assert.equal(JSON.stringify(result).includes('purchaseToken'),false);
  assert.equal(JSON.stringify(result).includes('INEA'),false);
});
test('expired rain product is stale, but current CAP does not imply current INMET thermometers',()=>{
  const result=buildRjFiveSourceHealth(sourceWorker({stale:true}),{nowMillis:now});
  assert.equal(result.sources[0].status,'STALE_OR_UNVERIFIED');
  assert.equal(result.sources[2].status,'CURRENT_PRODUCT_ONLY');
  assert.equal(result.sources[2].temperatureServiceConnected,false);
});
test('missing connector and inactive worker never claim connected source data',()=>{
  const partial=buildRjFiveSourceHealth(sourceWorker({onlyWarnings:true}),{nowMillis:now});
  assert.deepEqual(partial.sources.map(s=>s.status),[
    'NOT_CONNECTED','NOT_CONNECTED','CURRENT_PRODUCT_ONLY','NOT_CONNECTED','NOT_CONNECTED']);
  const off=buildRjFiveSourceHealth(sourceWorker({running:false}),{nowMillis:now});
  assert.ok(off.sources.every(s=>s.status==='NOT_CONNECTED'));
  assert.equal(off.workerRunning,false);
});
test('bad input clock or worker contract fails instead of inventing health evidence',()=>{
  assert.throws(()=>buildRjFiveSourceHealth(null));
  assert.throws(()=>buildRjFiveSourceHealth(sourceWorker(),{nowMillis:NaN}));
  assert.throws(()=>buildRjFiveSourceHealth({status:()=>({enabled:true,started:true})}));
});
