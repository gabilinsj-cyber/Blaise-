import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOwnMapObservationLayer,RJ_OWN_MAP_CHANNELS,RJ_OWN_MAP_RENDERER} from '../src/rj-own-map-observations.mjs';

const NOW=Date.parse('2026-10-10T18:00:00Z');
const sample={
  kind:'OFFICIAL_OBSERVATION',
  sourceId:'INMET_STATION', stationId:'A652', ibge:'3304557',
  variable:'TEMPERATURE_C',value:28.5,unit:'°C',
  longitude:-43.2,latitude:-22.9,
  observedAt:'2026-10-10T17:00:00.000Z',
  sourceUrl:'https://apitempo.inmet.gov.br/estacao/A652',
  usagePermissionStatus:'VERIFIED_FOR_APP_DATA_DISPLAY',
};
test('Blaise own map accepts valid current official station point only, never copied tiles or radar',()=>{
  const result=prepareOwnMapObservationLayer({observations:[sample],now:NOW});
  assert.equal(result.status,'AVAILABLE_STATION_POINTS');
  assert.equal(result.renderer,RJ_OWN_MAP_RENDERER);
  assert.equal(result.points.length,1);
  assert.equal(result.points[0].value,28.5);
  assert.equal(result.points[0].notMunicipalMean,true);
  assert.equal(result.thirdPartyImageCopied,false);
  assert.equal(result.radarFrameAvailable,false);
  assert.equal(result.estimatedMunicipalAverage,null);
  assert.equal(result.automaticWarningAuthorized,false);
});
test('Windy is a model comparison channel and never poses as public official observation',()=>{
  const model={...sample,sourceId:'WINDY_MODELO',kind:'OFFICIAL_OBSERVATION'};
  assert.equal(prepareOwnMapObservationLayer({observations:[model],now:NOW}).points.length,0);
  assert.equal(RJ_OWN_MAP_CHANNELS.filter(x=>x.type==='MODEL_COMPARISON').length,1);
});
test('public access alone does not self-authorize redistribution or commercial display',()=>{
  for(const usagePermissionStatus of [undefined,'PUBLICLY_ACCESSIBLE','UNKNOWN','NOT_VERIFIED','DENIED']) {
    assert.equal(prepareOwnMapObservationLayer({observations:[{...sample,usagePermissionStatus}],now:NOW}).points.length,0);
  }
});
test('exclude old, false coordinates, wrong municipality, URL and invalid measurement',()=>{
  const variants=[
    {...sample,observedAt:'2026-10-10T14:00:00.000Z'},
    {...sample,latitude:0},
    {...sample,sourceId:'ALERTA_RIO',ibge:'3303302'},
    {...sample,sourceUrl:'http://unsecured.example.test/data'},
    {...sample,value:9000},
    {...sample,variable:'SYNTHETIC_RADAR'},
    {...sample,kind:'MODEL_FORECAST'},
    {...sample,ibge:'4106902'},
  ];
  for(const row of variants) {
    const value=prepareOwnMapObservationLayer({observations:[row],now:NOW});
    assert.equal(value.points.length,0);
  }
});
test('two duplicate points cannot create a false denser coverage or municipality average',()=>{
  const result=prepareOwnMapObservationLayer({observations:[sample,sample],now:NOW});
  assert.equal(result.points.length,1);
  assert.equal(result.estimatedMunicipalAverage,null);
});
