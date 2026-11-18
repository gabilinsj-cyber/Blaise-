import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DWD_ICON_V1_T2M_ROOT,buildDwdIconV1Url,
  parseDwdIconV1RunIndex,selectDwdIconV1Step,discoverDwdIconV1Forecast
} from '../src/rj-dwd-icon-v1-source.mjs';
const now=Date.parse('2026-11-18T12:30:00.000Z');
const runHtml='<a href="2026-11-17T18:00/"></a>'+
  '<a href="2026-11-18T00%3A00/"></a>'+
  '<a href="2026-11-18T06:00/"></a>';
const stepHtml='<a href="PT003H00M.grib2"></a>'+
  '<a href="PT005H00M.grib2"></a>'+
  '<a href="PT006H00M.grib2"></a>'+
  '<a href="PT009H00M.grib2"></a>';
test('new source is DWD v1 T_2M plain GRIB, no old grib/ or .bz2 paths',()=>{
  assert.equal(DWD_ICON_V1_T2M_ROOT,
    'https://opendata.dwd.de/weather/nwp/v1/m/icon/p/T_2M/r/');
  assert.equal(buildDwdIconV1Url('2026-11-18T06:00',6),
    DWD_ICON_V1_T2M_ROOT+
    '2026-11-18T06%3A00/s/PT006H00M.grib2');
  assert.throws(()=>buildDwdIconV1Url('2026-11-18T06:00',6,15));
  assert.throws(()=>buildDwdIconV1Url('2026-11-18T03:00',6));
});
test('recent ISO model-run listing deduplicates and rejects future runs',()=>{
  const all=parseDwdIconV1RunIndex(runHtml+'<a href="2026-11-18T18:00/"></a>',{now});
  assert.equal(all.length,3);
  assert.equal(all[0].issuedAt,'2026-11-18T06:00:00.000Z');
  assert.ok(all[0].directoryUrl.includes('%3A00/s/'));
});
test('single native GRIB2 file selected from official DWD step index, no stale lookahead',()=>{
  const run=parseDwdIconV1RunIndex(runHtml,{now})[0];
  const step=selectDwdIconV1Step(stepHtml,run,{now});
  assert.equal(step.leadHours,6);
  assert.equal(step.validAt,'2026-11-18T12:00:00.000Z');
  assert.equal(step.sourceUrl,DWD_ICON_V1_T2M_ROOT+
    '2026-11-18T06%3A00/s/PT006H00M.grib2');
  assert.equal(selectDwdIconV1Step('<a href="PT024H00M.grib2"></a>',run,{now}),null);
});
test('only DWD official directories are requested from discovery',async()=>{
  const seen=[];
  const got=await discoverDwdIconV1Forecast(async url=>{
    seen.push(url);
    assert.ok(url.startsWith(DWD_ICON_V1_T2M_ROOT));
    return url===DWD_ICON_V1_T2M_ROOT?runHtml:stepHtml;
  },{now});
  assert.equal(got.leadHours,6);
  assert.ok(seen.length>=2);
  assert.ok(seen.every(u=>!u.includes('.bz2')));
});
test('unreachable indices return no fake reading',async()=>{
  const result=await discoverDwdIconV1Forecast(async url=>{
    if(url===DWD_ICON_V1_T2M_ROOT)return runHtml;
    throw Error('DWD upstream down');
  },{now});
  assert.equal(result,null);
});
