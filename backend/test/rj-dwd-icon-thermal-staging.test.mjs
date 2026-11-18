import test from 'node:test';
import assert from 'node:assert/strict';
import {DWD_RJ_RESEARCH_POINT,identifyDwd2mCandidate} from '../scripts/probe-dwd-icon-numeric-staging.mjs';
import geo from '../src/rj-ibge-92-points.json' with {type:'json'};
test('DWD test point is a verified IBGE polygon interior, never guessed device location',()=>{
  const p=geo.points.find(p=>p.ibge==='3304557');
  assert.equal(DWD_RJ_RESEARCH_POINT.ibge,'3304557');
  assert.equal(DWD_RJ_RESEARCH_POINT.lat,p.lat);
  assert.equal(DWD_RJ_RESEARCH_POINT.lon,p.lon);
  assert.equal(p.geometryStatus,'POINT_INSIDE_IBGE_MUNICIPAL_POLYGON');
});
test('only recent global ICON temperature 2m model file is eligible',()=>{
  const now=Date.parse('2026-11-18T10:00:00Z');
  const index='<a href="icon_global_icosahedral_single-level_2026111806_003_T_2M.grib2.bz2"></a>'+
    '<a href="icon_global_icosahedral_single-level_2026111806_003_FOO.grib2.bz2"></a>';
  const pick=identifyDwd2mCandidate(index,'06',{now});
  assert.equal(pick?.leadHours,3);
  assert.equal(pick?.issuedAt,'2026-11-18T06:00:00.000Z');
  assert.equal(pick?.validAt,'2026-11-18T09:00:00.000Z');
  assert.equal(identifyDwd2mCandidate(index,'00',{now}),null);
  assert.equal(identifyDwd2mCandidate(index,'06',{now:now+24*3600_000}),null);
});
