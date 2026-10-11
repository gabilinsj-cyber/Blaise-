import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRjRadarTimeline,RJ_RADAR_SPATIAL_LAYER_CONTRACT} from '../src/rj-radar-spatial-layer.mjs';
const now=Date.parse('2026-10-11T04:00:00Z');
const frame=(observedAt,other={})=>({
  dataType:'GEOREFERENCED_MEASURED_RADAR_RAIN_RATE',
  usagePermissionStatus:'VERIFIED_FOR_BLAISE_RJ_COMMERCIAL_DISPLAY',
  provider:'authorized-provider-id',radarId:'radar-RJ-1',calibrationId:'calib-2026-01',
  observedAt,sourceUrl:'https://provider.example.gov.br/radar/official-binary-product',
  cells:[{latitude:-22.9,longitude:-43.2,rainRateMmH:13.0,footprintKm:1.5},
    {latitude:-22.91,longitude:-43.18,rainRateMmH:0.0,footprintKm:1.5}],
  ...other,
});
test('a real fresh measured grid is presented as a native Blaise radar layer with provenance',()=>{
  const a=prepareRjRadarTimeline({now,frames:[frame('2026-10-11T03:55:00Z')]});
  assert.equal(a.status,'AVAILABLE_VERIFIED_RADAR_GRID_FRAMES');
  assert.equal(a.contract,RJ_RADAR_SPATIAL_LAYER_CONTRACT);
  assert.equal(a.frames[0].cells[0].rainRateMmH,13);
  assert.equal(a.sourceImageCopied,false);
  assert.equal(a.syntheticPixelsGenerated,false);
  assert.equal(a.warningsAuthorized,false);
});
test('30min timeline needs most recent frame <=10min old, identical calibrated radar and no duplicate frames',()=>{
  const valid=prepareRjRadarTimeline({now,frames:[
    frame('2026-10-11T03:31:00Z'),frame('2026-10-11T03:55:00Z'),
  ]});
  assert.equal(valid.frames.length,2);
  assert.equal(prepareRjRadarTimeline({now,frames:[
    frame('2026-10-11T03:31:00Z'),
  ]}).status,'UNAVAILABLE');
  assert.equal(prepareRjRadarTimeline({now,frames:[
    frame('2026-10-11T03:55:00Z'),frame('2026-10-11T03:55:00Z'),
  ]}).reason,'DUPLICATE_RADAR_FRAME_TIME');
  assert.equal(prepareRjRadarTimeline({now,frames:[
    frame('2026-10-11T03:54:00Z'),
    frame('2026-10-11T03:55:00Z',{calibrationId:'another-calib'}),
  ]}).reason,'INCOMPATIBLE_RADAR_OR_CALIBRATION');
});
test('never turn sparse surface stations, unknown license or copied radar images into weather pixels',()=>{
  const invalids=[
    frame('2026-10-11T03:55:00Z',{usagePermissionStatus:'PUBLICLY_ACCESSIBLE'}),
    frame('2026-10-11T03:55:00Z',{dataType:'STATION_POINT_OBSERVATION'}),
    frame('2026-10-11T03:55:00Z',{cells:[]}),
    frame('2026-10-11T03:55:00Z',{cells:[{latitude:0,longitude:0,rainRateMmH:12,footprintKm:1}]}),
    frame('2026-10-11T03:55:00Z',{cells:[{latitude:-22.9,longitude:-43.2,rainRateMmH:999,footprintKm:1}]}),
    frame('2026-10-11T03:55:00Z',{sourceUrl:'http://unsafe.test/radar'}),
  ];
  for(const row of invalids){
    const result=prepareRjRadarTimeline({now,frames:[row]});
    assert.equal(result.status,'UNAVAILABLE');
    assert.equal(result.frames.length,0);
    assert.equal(result.sourceImageCopied,false);
  }
  assert.equal(prepareRjRadarTimeline({now,frames:[]}).reason,
    'NO_AUTHORIZED_RADAR_GRID_INPUT');
});
