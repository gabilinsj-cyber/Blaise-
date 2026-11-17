import test from 'node:test';
import assert from 'node:assert/strict';
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
import {
  interiorPoint,pointInsideMunicipality,prepareIbgeRjPoints,
} from '../scripts/validate-rj-92-ibge-points.mjs';

const polygon=(w,s,e,n)=>[[[w,s],[e,s],[e,n],[w,n],[w,s]]];
const rect=(i)=>({type:'Polygon',
  coordinates:polygon(-45+i*0.01,-24,-44.995+i*0.01,-23.995)});
const feature=(ibge,i)=>({
  type:'Feature',id:ibge,
  properties:{codarea:ibge},
  geometry:rect(i)
});
test('scanline picks a point inside concave polygons, not a bbox assumption',()=>{
  const shape={type:'Polygon',coordinates:[[
    [-44,-24],[-43,-24],[-43,-23.8],[-43.8,-23.8],
    [-43.8,-23.2],[-44,-23.2],[-44,-24]
  ]]};
  const p=interiorPoint(shape);
  assert.ok(p);
  assert.ok(pointInsideMunicipality(p,shape));
});
test('official IBGE candidate must exactly match 92 unique codes with interior points',()=>{
  const geojson={type:'FeatureCollection',
    features:RJ_MUNICIPALITIES.map((city,i)=>feature(city.ibge,i))};
  const evidence=prepareIbgeRjPoints(geojson);
  assert.equal(evidence.municipalityCount,92);
  assert.equal(evidence.points.length,92);
  assert.equal(evidence.productionActivated,false);
  assert.equal(evidence.points.filter(p=>p.altitudeVerified).length,0);
  assert.equal(new Set(evidence.points.map(p=>p.ibge)).size,92);
  assert.ok(evidence.points.every(p=>p.geometryStatus==='POINT_INSIDE_IBGE_MUNICIPAL_POLYGON'));
});
test('invalid coverage, mismatched IBGE IDs and missing geometries fail closed',()=>{
  const rows=RJ_MUNICIPALITIES.map((city,i)=>feature(city.ibge,i));
  const good={type:'FeatureCollection',features:rows};
  assert.throws(()=>prepareIbgeRjPoints({...good,features:rows.slice(1)}));
  assert.throws(()=>prepareIbgeRjPoints({...good,features:[...rows.slice(0,91),rows[0]]}));
  assert.throws(()=>prepareIbgeRjPoints({...good,features:[...rows.slice(0,91),{
    ...rows[91],geometry:{type:'Point',coordinates:[-43,-22]}
  }]}));
});
