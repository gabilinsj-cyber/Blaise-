import assert from 'node:assert/strict';
import test from 'node:test';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import { buildStatewideDashboardSnapshot, STATEWIDE_SOURCE_RESPONSIBILITIES } from '../src/statewide-dashboard.mjs';
import { INMET_SOURCE_ID, INMET_CAP_RSS_URL } from '../src/inmet-source.mjs';

const now=Date.parse('2026-11-17T14:00:00Z');
const stamp=new Date(now-60_000).toISOString();
function contaminatedWorker(active=true){
  const hydro={sourceId:'cemaden-rj-hydrological-risk',state:'CURRENT',fetchedAt:stamp,
    snapshot:{sourceId:'cemaden-rj-hydrological-risk',records:RJ_MUNICIPALITIES.map(city=>({
      ibge:city.ibge,priority:5,risk:'MUITO ALTO',observedAt:stamp,redec:'SERRANA I'
    }))}};
  const cap={sourceId:INMET_SOURCE_ID,state:'CURRENT',fetchedAt:stamp,
    snapshot:{sourceId:INMET_SOURCE_ID,sourceUrl:INMET_CAP_RSS_URL,rjWarnings:[{
      identifier:'domestic-fixture-warning',event:'domestic fixture',status:'Actual',msgType:'Alert',
      sent:stamp,onset:stamp,expires:new Date(now+60_000).toISOString(),rjMunicipalityIbges:['3304557']
    }]}};
  return {
    status:()=>({enabled:active,started:true,sources:[hydro,cap]}),
    readSource:id=>{
      if(id===hydro.sourceId)return hydro;
      if(id===cap.sourceId)return cap;
      throw Error('unavailable');
    },
  };
}

test('all 92 canonical municipality rows remain but INMET/CEMADEN payloads never enter customer snapshot',()=>{
  const out=buildStatewideDashboardSnapshot(contaminatedWorker(),{nowMillis:now});
  assert.equal(out.municipalities.length,92);
  assert.equal(new Set(out.municipalities.map(x=>x.ibge)).size,92);
  assert.equal(out.municipalities.find(x=>x.ibge==='3304557').name,'Rio de Janeiro');
  assert.deepEqual(out.warnings,[]);
  assert.ok(out.municipalities.every(row=>row.hydrologicalRisk.state==='UNAVAILABLE' &&
    row.hydrologicalRisk.level===null && row.hydrologicalRisk.label===null &&
    row.hydrologicalRisk.sourceUrl===null && row.warningIds.length===0 &&
    row.warningCoverage==='UNAVAILABLE'));
  assert.equal(JSON.stringify(out).includes('domestic fixture'),false);
  // Only municipal official alert links are public; domestic comparisons stay private.
  assert.deepEqual(out.officialNoticeLinks.map(link=>link.id), ['defesa-civil-rj', 'alerta-rio']);
  assert.ok(out.officialNoticeLinks.every(link=>!/(inmet|cemaden)/i.test(link.id+' '+link.url)));
  assert.ok(out.sources.every(source=>!/(inmet|cemaden)/i.test(source.id+' '+source.name)));
  assert.ok(out.officialNoticeLinks.every(link=>!Object.hasOwn(link,'level')&&!Object.hasOwn(link,'severity')));
});

test('domestic providers cannot be part of public source catalog regardless of worker status',()=>{
  assert.ok(STATEWIDE_SOURCE_RESPONSIBILITIES.every(s=>
    !/(?:inmet|cemaden|inea)/i.test(s.id+' '+s.name)));
  const out=buildStatewideDashboardSnapshot(contaminatedWorker(),{nowMillis:now});
  assert.ok(out.sources.every(s=>s.connectedProduct===null));
  assert.ok(out.sources.some(s=>s.id==='noaa'));
  assert.equal(out.workerActive,true);
});

test('inactive worker also never reveals internal domestic observations',()=>{
  const out=buildStatewideDashboardSnapshot(contaminatedWorker(false),{nowMillis:now});
  assert.equal(out.workerActive,false);
  assert.deepEqual(out.warnings,[]);
  assert.ok(out.municipalities.every(x=>x.hydrologicalRisk.level===null));
});
