import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RJ_RAINVIEWER_POLICY,isExcludedRjRadarProduct
} from '../src/rj-radar-excluded-providers.mjs';
import {RJ_SOS_CHUVA_POLICY} from '../src/rj-sos-chuva-exclusion.mjs';
import {prepareRjRadarTimeline} from '../src/rj-radar-spatial-layer.mjs';

const NOW=Date.parse('2026-11-13T18:00:00Z');
const frame=patch=>({
  dataType:'GEOREFERENCED_MEASURED_RADAR_RAIN_RATE',
  usagePermissionStatus:'VERIFIED_FOR_BLAISE_RJ_COMMERCIAL_DISPLAY',
  provider:'independent-authorized-radar',radarId:'rj-test-1',
  calibrationId:'calib-2026',
  observedAt:'2026-11-13T17:59:00Z',
  sourceUrl:'https://licensed.example.org/raw-grid',
  cells:[{latitude:-22.91,longitude:-43.21,rainRateMmH:12,footprintKm:1}],
  ...patch
});
test('RainViewer and SOS Chuva are excluded from Blaise radar even as fallback',()=>{
  assert.equal(RJ_RAINVIEWER_POLICY.state,'EXCLUDED_FROM_BLAISE_RJ');
  assert.equal(RJ_RAINVIEWER_POLICY.automaticDataCollection,false);
  assert.equal(RJ_RAINVIEWER_POLICY.mapTiles,false);
  assert.equal(RJ_SOS_CHUVA_POLICY.state,'EXCLUDED');
  assert.equal(RJ_SOS_CHUVA_POLICY.fallback,false);
});
test('deny RainViewer direct provider and white-label source URLs',()=>{
  for(const x of [
    {provider:'RainViewer'},
    {sourceId:'RAIN_VIEWER_API'},
    {sourceUrl:'https://tilecache.rainviewer.com/v2/radar/a.png'},
    {upstreamUrl:'https://api.rainviewer.com/public/weather-maps.json'},
    {provenance:{originalProducerId:'rainviewer'}},
    {provenance:{upstream:{productUrl:'https://www.rainviewer.com/weather-radar-map-live'}}}
  ]){
    const f=frame(x);
    assert.equal(isExcludedRjRadarProduct(f),true);
    assert.equal(prepareRjRadarTimeline({frames:[f],now:NOW}).status,'UNAVAILABLE');
  }
});
test('deny SOS Chuva direct and mirrored upstream products',()=>{
  for(const x of [
    {sourceId:'SOS_CHUVA_CPTEC_INPE'},
    {sourceUrl:'https://satelite.cptec.inpe.br/soschuvaapp/#hero'},
    {provenance:{sourceId:'INPE_SOS_CHUVA'}},
    {upstream:{originalSourceUrl:'https://satelite.cptec.inpe.br/soschuvaapp/map'}}
  ]){
    const f=frame(x);
    assert.equal(isExcludedRjRadarProduct(f),true);
    assert.equal(prepareRjRadarTimeline({frames:[f],now:NOW}).status,'UNAVAILABLE');
  }
});
test('do not accidentally ban independent authorized physical radars or NOAA product',()=>{
  for(const f of [frame({}),frame({provider:'NOAA',
      sourceUrl:'https://www.noaa.gov/source-data',radarId:'noaa-test'})]){
    assert.equal(isExcludedRjRadarProduct(f),false);
    assert.equal(prepareRjRadarTimeline({frames:[f],now:NOW}).status,
      'AVAILABLE_VERIFIED_RADAR_GRID_FRAMES');
  }
});
test('lookalike host does not masquerade as the blocked real hostname',()=>{
  assert.equal(isExcludedRjRadarProduct(frame({
    sourceUrl:'https://rainviewer.com.attacker.example/radar'
  })),false);
});
