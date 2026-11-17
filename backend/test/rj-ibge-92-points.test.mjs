import test from 'node:test';
import assert from 'node:assert/strict';
import points from '../src/rj-ibge-92-points.json' with {type:'json'};
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
import {initializeOptionalMetNorwayRuntime} from '../src/rj-met-norway-runtime-optional.mjs';
test('real IBGE audited polygons provide 92 unique municipality reference points, no guessed altitude',()=>{
  assert.equal(points.contract,'BLAISE_RJ_IBGE_92_INTERIOR_POINTS_CANDIDATE_V1');
  assert.equal(points.municipalityCount,92);
  assert.equal(points.points.length,92);
  assert.equal(points.productionActivated,false);
  assert.match(points.sourceSha256,/^[a-f0-9]{64}$/);
  const ids=points.points.map(x=>x.ibge).sort();
  assert.deepEqual(ids,RJ_MUNICIPALITIES.map(x=>x.ibge).sort());
  assert.equal(new Set(points.points.map(x=>x.lat+'|'+x.lon)).size,92);
  assert.ok(points.points.every(x=>x.verifiedByBackend===true&&
    x.geometryStatus==='POINT_INSIDE_IBGE_MUNICIPAL_POLYGON'&&
    x.altitudeM===null&&x.altitudeVerified===false&&
    x.lat>=-25&&x.lat<=-20&&x.lon>=-46&&x.lon<=-40));
});
test('MET disabled runtime knows 92 coordinates but never calls provider or changes production',async()=>{
  const result=await initializeOptionalMetNorwayRuntime();
  assert.equal(result.state,'DISABLED');
  assert.equal(result.configured,false);
  assert.equal(result.publishedToAndroid,false);
  assert.equal(result.productionEnabled,false);
  assert.equal(result.supportedMunicipalities.length,92);
  assert.ok(result.supportedMunicipalities.includes('3304904'));
  assert.equal(await result.readCachedCity('3304904'),null);
});
