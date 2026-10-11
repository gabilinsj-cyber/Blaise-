import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import { RJ_PHENOMENA } from '../src/rj-phenomenon-source-policy.mjs';
import {
  RJ_CANONICAL_25_PHENOMENA,
  RJ_CANONICAL_25_COUNT,
  RJ_SOURCE_TIEBREAK_ORDER,
  RJ_CANONICAL_SOURCE_GATES,
  rjCanonical25Consultation,
} from '../src/rj-canonical-25-matrix.mjs';

test('approved RJ master matrix has exactly 25 unique items while legacy route catalog stays separate',()=>{
  assert.equal(RJ_CANONICAL_25_COUNT,25);
  assert.equal(RJ_CANONICAL_25_PHENOMENA.length,25);
  assert.equal(new Set(RJ_CANONICAL_25_PHENOMENA.map(x=>x.id)).size,25);
  assert.equal(RJ_MUNICIPALITIES.length,92);
  assert.equal(RJ_PHENOMENA.length,23);
  assert.equal(RJ_CANONICAL_SOURCE_GATES.inea,'EXCLUDED');
  assert.ok(RJ_CANONICAL_25_PHENOMENA.every(row=>
    !/INEA/.test(row.primarySources+row.comparisonSources)));
});
test('all approved specific topics appear: lightning, pressure, tide, sea temperature, drought, 1–7d forecast',()=>{
  const names=new Set(RJ_CANONICAL_25_PHENOMENA.map(x=>x.id));
  for(const id of ['PRESSAO_ATMOSFERICA','RAIOS_DESCARGAS','MARES',
    'TEMPERATURA_DO_MAR','NIVEL_DOS_RIOS','SECA_ESTIAGEM','PREVISAO_1_7_DIAS']){
    assert.ok(names.has(id),id);
    const x=rjCanonical25Consultation({ibge:'3304557',phenomenonId:id});
    assert.equal(x.routingImplementation,'CANONICAL_SPEC_PENDING_DEDICATED_ADAPTER');
    assert.equal(x.dataStatus,'NOT_VALIDATED_CURRENT');
    assert.equal(x.automatedAlertIssued,false);
  }
});
test('exact situational hierarchy: Alerta Rio, Defesa Civil, INMET, INPE then Windy',()=>{
  assert.deepEqual(RJ_SOURCE_TIEBREAK_ORDER,[
    'ALERTA_RIO_RIO_CITY_ONLY','DEFESA_CIVIL_LOCAL_AUTHORITY',
    'INMET_STATION','INPE_CPTEC_FORECAST_FIRST_MODEL_COMPARISON',
    'WINDY_MODEL_ONLY_IF_INPE_INCONCLUSIVE',
  ]);
  const rio=rjCanonical25Consultation({ibge:'3304557',phenomenonId:'TEMPERATURA'});
  assert.equal(rio.eligibleSources[0].id,'ALERTA_RIO');
  assert.equal(rio.eligibleSources[1].id,'DEFESA_CIVIL_RJ_REGIONAL');
  assert.equal(rio.eligibleSources[2].id,'INMET_STATION');
  assert.equal(rio.eligibleSources[3].id,'INPE_CPTEC_FORECAST');
  assert.equal(rio.eligibleSources[4].id,'WINDY_MODELO');
  const niteroi=rjCanonical25Consultation({ibge:'3303302',phenomenonId:'TEMPERATURA'});
  assert.equal(niteroi.eligibleSources.some(s=>s.id==='ALERTA_RIO'),false);
  assert.equal(niteroi.eligibleSources[0].id,'DEFESA_CIVIL_RJ_REGIONAL');
});
test('every RJ municipality can select every canonical phenomenon without fake active-monitoring status',()=>{
  for(const city of RJ_MUNICIPALITIES){
    for(const x of RJ_CANONICAL_25_PHENOMENA){
      const p=rjCanonical25Consultation({ibge:city.ibge,phenomenonId:x.id});
      assert.equal(p.dataStatus,'NOT_VALIDATED_CURRENT');
      assert.equal(p.consensusConfirmed,false);
      assert.equal(p.automatedAlertIssued,false);
      if(x.id==='TEMPERATURA' && city.ibge!=='3304557'){
        assert.equal(p.eligibleSources.some(src=>src.id==='ALERTA_RIO'),false);
      }
    }
  }
});
test('reject cross-state identity and unknown phenomenon rather than synthesize readings',()=>{
  assert.throws(()=>rjCanonical25Consultation({ibge:'4106902',phenomenonId:'TEMPERATURA'}),TypeError);
  assert.throws(()=>rjCanonical25Consultation({ibge:'3304557',phenomenonId:'DADO_FICTICIO'}),TypeError);
});
test('maritime and sismology source priority follows specialized competent authorities',()=>{
  const marine=rjCanonical25Consultation({ibge:'3304557',phenomenonId:'RESSACA',region:'LITORAL'});
  assert.equal(marine.eligibleSources[0].id,'MARINHA_CHM');
  const sea=rjCanonical25Consultation({ibge:'3304557',phenomenonId:'SISMOS',region:'ATLANTICO'});
  assert.equal(sea.eligibleSources[0].id,'USGS_EARTHQUAKE');
  const tsunami=rjCanonical25Consultation({ibge:'3304557',phenomenonId:'TSUNAMI_MAREMOTO',region:'LITORAL'});
  assert.equal(tsunami.eligibleSources[0].id,'MARINHA_CHM');
  assert.equal(RJ_CANONICAL_SOURCE_GATES.seismicAndMarineWarningsRequireCompetentAuthority,true);
});
