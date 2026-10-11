import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import {evaluateRjScientificRiskSnapshot,RJ_SCIENCE_RISK_CONTRACT}
  from '../src/rj-science-risk-engine.mjs';

const now=Date.parse('2026-10-11T03:00:00Z');
const fresh=new Date(now-60_000).toISOString();
const until=new Date(now+3_600_000).toISOString();
function source({active=true,staleHydro=false,cap='Severe',capScope=['3304557'],
  hydro=4, hydroAt=fresh}={}) {
  return {
    scope:'RJ_92_MUNICIPALITIES',workerActive:active,
    municipalities:RJ_MUNICIPALITIES.map(c=>({
      ibge:c.ibge,name:c.name,
      hydrologicalRisk:c.ibge==='3304557' ? {
        state:staleHydro?'STALE':'CURRENT',
        observedAt:hydroAt,sourceUrl:'https://painelcemadenrj.defesacivil.rj.gov.br/',
        level:hydro,label:'ALTO',
      }:{state:'UNAVAILABLE',observedAt:null,level:null},
    })),
    warnings:cap===null?[]:[{
      id:'official-inmet-2026-test',severity:cap,event:'Chuva Intensa',
      attribution:'EXACT_IBGE',sent:fresh,onset:fresh,expires:until,
      sourceUrl:'https://apiprevmet3.inmet.gov.br/avisos/rss',
      municipalityIbges:capScope,
    }],
  };
}
const scientificJob={
  id:'job-rj-1',method:'equivalentPotentialTemperatureApprox',
  scopeId:'municipality:3304557',validAt:fresh,maxAgeMs:3600_000,
  sources:[{
    sourceId:'INMET_STATION',sourceUrl:'https://apitempo.inmet.gov.br/estacao/A652',
    scopeId:'municipality:3304557',nature:'OBSERVADO',quality:'VALIDATED',
    observedAt:fresh,validAt:fresh,
  }],
  inputs:{temperatureK:298.15,pressurePa:101325,specificHumidityKgKg:0.010},
};
test('92 municipalities stay distinct and high official risk is visible without siren or inventing source consensus',()=>{
  const result=evaluateRjScientificRiskSnapshot({
    sourceSnapshot:source(),nowMillis:now,
    scientificJobs:[scientificJob],
  });
  assert.equal(result.contract,RJ_SCIENCE_RISK_CONTRACT);
  assert.equal(result.municipalities.length,92);
  assert.equal(new Set(result.municipalities.map(x=>x.ibge)).size,92);
  const rio=result.municipalities.find(x=>x.ibge==='3304557');
  assert.equal(rio.hydroScale,4);
  assert.equal(rio.meteorologicalWarningScale,4);
  assert.equal(rio.officialDisplayScale,4);
  assert.equal(rio.reviewState,'HIGH_PRIORITY_OFFICIAL_SOURCE_RECHECK_REQUIRED');
  assert.equal(rio.highRiskSourceRecheckMs,60_000);
  assert.equal(rio.officialWarningDisplayAllowed,true);
  assert.equal(rio.differentPhenomenaAreNotIndependentConfirmations,true);
  assert.equal(rio.scientificDiagnostics[0].nature,'CALCULO_EXPERIMENTAL_BLAISE');
  assert.equal(rio.scientificDiagnostics[0].officialAlert,false);
  assert.equal(rio.publisherReviewAuthorized,false);
  assert.equal(rio.audibleAlertAuthorized,false);
  assert.equal(result.scientificJobsAccepted,1);
  assert.deepEqual(result.agentsApplied,[1,2,3,5,8]);
  const niteroi=result.municipalities.find(x=>x.ibge==='3303302');
  assert.equal(niteroi.officialDisplayScale,null);
  assert.equal(niteroi.safetyAssured,false);
  assert.equal(niteroi.scientificDiagnostics.length,0);
});
test('an explicit INMET Extreme CAP warning is shown as level 5 but not transformed into automatic extreme audio',()=>{
  const result=evaluateRjScientificRiskSnapshot({
    sourceSnapshot:source({cap:'Extreme',hydro:1}),nowMillis:now,
  });
  const rio=result.municipalities.find(x=>x.ibge==='3304557');
  assert.equal(rio.officialDisplayScale,5);
  assert.equal(rio.meteorologicalWarningScale,5);
  assert.equal(rio.hydroScale,1);
  assert.equal(rio.highRiskSourceRecheckMs,60_000);
  assert.equal(rio.highRiskScienceRecheckMs,60_000);
  assert.equal(result.automaticAlertAuthorized,false);
  assert.equal(result.extremeGateStatus,'NOT_AUTHORIZED');
});
test('stale hydrological risk and expired CAP cannot be represented as low risk, and no scientific method can fill gaps',()=>{
  const old=new Date(now-3_600_000).toISOString();
  const noWarnings=evaluateRjScientificRiskSnapshot({
    sourceSnapshot:source({staleHydro:true,cap:null,hydroAt:old}),
    nowMillis:now,scientificJobs:[scientificJob],
  });
  const rio=noWarnings.municipalities.find(x=>x.ibge==='3304557');
  assert.equal(rio.officialDisplayScale,null);
  assert.equal(rio.reviewState,'NO_CURRENT_OFFICIAL_RISK_EVIDENCE');
  assert.equal(rio.diagnosticCount,1);
  assert.equal(rio.officialWarningDisplayAllowed,false);
  assert.equal(rio.publisherReviewAuthorized,false);
});
test('municipally unresolved or stale warning is not spread across every city',()=>{
  const unresolved=source({capScope:[]});
  const result=evaluateRjScientificRiskSnapshot({
    sourceSnapshot:unresolved,nowMillis:now,
  });
  assert.equal(result.municipalities.filter(x=>x.meteorologicalWarningScale!==null).length,0);
  const expired=source({cap:'Extreme'});
  expired.warnings[0].expires=new Date(now-1).toISOString();
  const parsed=evaluateRjScientificRiskSnapshot({sourceSnapshot:expired,nowMillis:now});
  assert.equal(parsed.municipalities.find(x=>x.ibge==='3304557').meteorologicalWarningScale,null);
});
test('stale, invalid scientific inputs fail closed without overwriting validated official danger',()=>{
  const bad=[{
    ...scientificJob,
    sources:[{...scientificJob.sources[0],observedAt:new Date(now-7_200_000).toISOString()}],
  }];
  const result=evaluateRjScientificRiskSnapshot({
    sourceSnapshot:source(),nowMillis:now,scientificJobs:bad,
  });
  const rio=result.municipalities.find(x=>x.ibge==='3304557');
  assert.equal(rio.officialDisplayScale,4);
  assert.equal(rio.diagnosticCount,0);
  assert.equal(result.scientificJobsEvaluated,1);
  assert.equal(result.scientificJobsAccepted,0);
});
test('invalid municipality inventories and disconnected workers provide no fake 1-5 scale',()=>{
  for(const invalid of [
    source({active:false}),{
      ...source(),municipalities:source().municipalities.slice(0,91),
    },{
      ...source(),municipalities:source().municipalities.map((c,i)=>(
        i===0?{...c,ibge:'4106902'}:c)),
    },
  ]){
    const r=evaluateRjScientificRiskSnapshot({sourceSnapshot:invalid,nowMillis:now});
    assert.equal(r.state,'NO_VALID_OFFICIAL_SNAPSHOT');
    assert.equal(r.municipalities.length,0);
    assert.equal(r.audibleAlertAuthorized,false);
  }
  assert.throws(()=>evaluateRjScientificRiskSnapshot({
    sourceSnapshot:source(),scientificJobs:Array(65).fill(scientificJob),nowMillis:now,
  }),/bounded_jobs/);
});
test('CAP level descriptions represent source severity, never a numeric average of official warning and risk',()=>{
  const variants=[['Minor',2],['Moderate',3],['Severe',4],['Extreme',5]];
  for(const [cap,scale] of variants){
    const result=evaluateRjScientificRiskSnapshot({
      sourceSnapshot:source({cap,hydro:1}),nowMillis:now,
    });
    const rio=result.municipalities.find(x=>x.ibge==='3304557');
    assert.equal(rio.meteorologicalWarningScale,scale);
    assert.equal(rio.officialDisplayScale,scale);
    assert.equal(rio.autoEscalationAuthorized,false);
  }
});
