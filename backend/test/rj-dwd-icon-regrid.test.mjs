import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseDwdWeightMembers,DWD_ICON_OFFICIAL_WEIGHTS_URL
} from '../src/rj-dwd-icon-regrid.mjs';
test('uses DWD official 0.25-degree weights, never model-independent fabricated grids',()=>{
  assert.equal(DWD_ICON_OFFICIAL_WEIGHTS_URL,
    'https://opendata.dwd.de/weather/lib/cdo/ICON_GLOBAL2WORLD_025_EASY.tar.bz2');
  const result=chooseDwdWeightMembers([
    './target_grid_world_025.txt','./weights_icogl2world_025.nc'
  ]);
  assert.equal(result.target,'./target_grid_world_025.txt');
  assert.equal(result.weights,'./weights_icogl2world_025.nc');
});
test('rejects missing, duplicate, or traversal-containing archive grid/weight references',()=>{
  for(const files of [
    ['target_grid_world_025.txt'],
    ['./target_grid_world_025.txt','weights_icogl2world_025.nc',
     'weights_icogl2world_025.nc'],
    ['../target_grid_world_025.txt','weights_icogl2world_025.nc'],
    ['/etc/passwd','weights_icogl2world_025.nc'],
  ])assert.throws(()=>chooseDwdWeightMembers(files));
});
