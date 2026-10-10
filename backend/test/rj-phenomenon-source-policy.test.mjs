import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import {
  RJ_MUNICIPALITY_COUNT, RJ_PHENOMENA, RJ_SOURCE_CLASS,
  rjSourceRouting,
} from '../src/rj-phenomenon-source-policy.mjs';

test('all 92 RJ municipalities route rainstorm and gust sources without creating coverage', () => {
  assert.equal(RJ_MUNICIPALITY_COUNT, 92);
  for (const { ibge } of RJ_MUNICIPALITIES) {
    for (const phenomenon of ['CHUVA_ACUMULADA','TEMPORAL','TEMPESTADE','RAJADA','TEMPERATURA','SENSACAO_TERMICA']) {
      const route = rjSourceRouting({ ibge, phenomenon });
      assert.equal(route.liveData, 'NOT_CONFIRMED');
      assert.equal(route.municipalitySelectionCoverage, 92);
      assert.equal(route.geographicScope, 'RJ_INCLUI_MUNICIPIOS_DE_DIVISA_SEM_CONFUNDIR_DADOS_DE_ESTADOS_VIZINHOS');
      assert.equal(route.crossBorderDataPolicy, 'OUTSIDE_RJ_ONLY_AS_EXPLICITLY_LABELED_REGIONAL_CONTEXT_NOT_RJ_OBSERVATION');
      assert.equal(route.ineaPolicy, 'EXCLUDED');
      assert.equal(route.sources.every(source => source.automaticAlertAuthority === false), true);
      assert.equal(route.sources.some(s => /INEA/i.test(s.id)), false);
      assert.equal(route.sources.some(s => s.id === 'WINDY_MODELO'), true);
      assert.equal(route.sources.at(-1).role, RJ_SOURCE_CLASS.COMPARISON);
      assert.equal(route.sources.some(s => s.id === 'ALERTA_RIO'), ibge === '3304557');
    }
  }
});

test('Rio city is the only municipality with the Alerta Rio municipal source', () => {
  const rio = rjSourceRouting({ ibge: '3304557', phenomenon: 'RADAR' });
  const niteroi = rjSourceRouting({ ibge: '3303302', phenomenon: 'RADAR' });
  assert.equal(rio.sources[0].id, 'ALERTA_RIO');
  assert.equal(niteroi.sources.some(s => s.id === 'ALERTA_RIO'), false);
  assert.equal(rio.sources.every(s => s.dataAvailability === 'REQUIRES_LIVE_VALIDATION'), true);
});
test('Atlantic extratropical cyclone, sea, rainfall and fronts have official and comparison channels', () => {
  for (const phenomenon of ['CICLONE_EXTRATROPICAL','CHUVA_ATLANTICO','MASSA_AR','RESSACA','ONDAS']) {
    const route = rjSourceRouting({ region: 'ATLANTICO', phenomenon });
    assert.equal(route.sources.some(s => s.id === 'MARINHA_CHM' || s.id === 'NOAA'), true);
    assert.equal(route.sources.some(s => s.id === 'WINDY_MODELO'), true);
    assert.equal(route.windyPolicy, 'MODEL_COMPARISON_NO_OFFICIAL_TIE_BREAK');
  }
});
test('five situational main channels include separate INMET/INPE identities and no fictitious live data', () => {
  for (const phenomenon of ['TEMPERATURA','CHUVA_ACUMULADA','TEMPORAL','RAJADA']) {
    const rio=rjSourceRouting({ibge:'3304557',phenomenon});
    assert.equal(rio.sources.some(s=>s.id==='ALERTA_RIO'),true);
    assert.equal(rio.sources.some(s=>s.id==='DEFESA_CIVIL_RJ_REGIONAL'),true);
    assert.equal(rio.sources.some(s=>s.id==='INMET_STATION'),true);
    assert.equal(rio.sources.some(s=>s.id==='INPE_CPTEC_FORECAST'),true);
    assert.equal(rio.sources.some(s=>s.id==='WINDY_MODELO'),true);
    assert.equal(rio.liveData,'NOT_CONFIRMED');
    assert.equal(rio.sources.find(s=>s.id==='INPE_CPTEC_FORECAST').role,RJ_SOURCE_CLASS.OFFICIAL_MODEL);
    assert.equal(rio.sources.find(s=>s.id==='INMET_STATION').role,RJ_SOURCE_CLASS.AUTHORITATIVE);
    assert.equal(rio.sources.every(s=>s.automaticAlertAuthority===false),true);
  }
  const niteroi=rjSourceRouting({ibge:'3303302',phenomenon:'TEMPERATURA'});
  assert.equal(niteroi.sources.some(s=>s.id==='ALERTA_RIO'),false);
  assert.equal(niteroi.sources.some(s=>s.id==='INPE_CPTEC_FORECAST'),true);
  assert.equal(rjSourceRouting({ibge:'3304557',phenomenon:'VAZAO_RIO'}).sources.some(s=>s.id==='INPE_CPTEC_FORECAST'),false);
});

test('river streamflow, flood and alert authorities never gain fake Windy flow measurements', () => {
  const vazao = rjSourceRouting({ ibge: '3303302', phenomenon: 'VAZAO_RIO' });
  assert.equal(vazao.sources[0].id, 'ANA_HIDROWEB');
  assert.equal(vazao.sources.some(s => s.id === 'WINDY_MODELO'), false);
  const risk = rjSourceRouting({ ibge: '3303302', phenomenon: 'RISCO_HIDROLOGICO' });
  assert.equal(risk.sources.some(s => s.id === 'SGB_SACE'), true);
});
test('unknown municipality or phenomenon is blocked rather than treated as Rio', () => {
  assert.throws(() => rjSourceRouting({ ibge: '4106902', phenomenon: 'TEMPERATURA' }));
  assert.throws(() => rjSourceRouting({ ibge: '3304557', phenomenon: 'FURACAO' }));
  assert.equal(RJ_PHENOMENA.includes('CICLONE_EXTRATROPICAL'), true);
});
