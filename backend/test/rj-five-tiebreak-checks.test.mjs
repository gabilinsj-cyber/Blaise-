import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
import {
  RJ_FIVE_TIEBREAK_CHECKS,planRjFiveDisagreementChecks,
} from '../src/rj-five-tiebreak-checks.mjs';

test('five checks begin with INPE and INMET, preserve OWM Windy and specialist marine',()=>{
  assert.equal(RJ_FIVE_TIEBREAK_CHECKS.length,5);
  assert.deepEqual(RJ_FIVE_TIEBREAK_CHECKS.map(x=>x.code),
    ['INPE_CPTEC','INMET_STATION','OPENWEATHER_THIRD',
      'WINDY_SECONDARY','MAR_ATLANTICO_SPECIALIST']);
  assert.equal(RJ_FIVE_TIEBREAK_CHECKS[4].providerIds.includes('COPERNICUS_MARINE'),true);
  assert.equal(RJ_FIVE_TIEBREAK_CHECKS[4].providerIds.includes('EUMETSAT_SATELLITE'),true);
});
test('no false Alerta Rio coverage outside municipality of Rio',()=>{
  assert.equal(RJ_MUNICIPALITIES.length,92);
  for(const {ibge} of RJ_MUNICIPALITIES){
    const plan=planRjFiveDisagreementChecks({ibge,phenomenon:'TEMPERATURA'});
    assert.equal(plan.primaryOfficialPriority.includes('ALERTA_RIO'),ibge==='3304557');
    assert.equal(plan.fiveSupplementalChecks.every(x=>x.observedLiveProduct===false),true);
    assert.equal(plan.canAverageObservationAndForecast,false);
    assert.equal(plan.mayIssueAlert,false);
    assert.equal(plan.fiveSupplementalChecks[4].applicable,false);
  }
});
test('marine checks activate only for phenomenon with specialized marine sources',()=>{
  const plan=planRjFiveDisagreementChecks({ibge:'3304557',phenomenon:'RESSACA'});
  assert.equal(plan.fiveSupplementalChecks[4].applicable,true);
  assert.ok(plan.fiveSupplementalChecks[4].rule.includes('tsunami'));
  assert.throws(()=>planRjFiveDisagreementChecks({ibge:'4106902',phenomenon:'TEMPERATURA'}));
});
