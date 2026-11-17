/**
 * One-time STAGING preparation of 92 RFC-7946 municipality interior points.
 * Source: official IBGE state malhas GeoJSON. No user GPS, no MET Norway calls.
 * Output is a CANDIDATE data artifact, not automatic authorization to publish.
 */
import {RJ_MUNICIPALITIES} from '../src/rio-municipalities.mjs';
import {createHash} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const IBGE_RJ_MALHAS_URL='https://servicodados.ibge.gov.br/api/v3/malhas/estados/33?intrarregiao=municipio&formato=application%2Fvnd.geo%2Bjson&qualidade=minima';
export const RJ_VERIFIED_OLD_POINTS=Object.freeze({
  '3304557':[-43.1729,-22.9068],
  '3303302':[-43.1036,-22.8833],
});
const isPoint=p=>Array.isArray(p)&&p.length>=2&&p.every((v,i)=>i>1||typeof v==='number'&&Number.isFinite(v));
const pointInRing=(p,ring)=>{
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<
      (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
};
const geometryPolygons=shape=>{
  if(shape?.type==='Polygon')return [shape.coordinates];
  if(shape?.type==='MultiPolygon')return shape.coordinates;
  return [];
};
export function pointInsideMunicipality(p,shape){
  return geometryPolygons(shape).some(poly=>Array.isArray(poly)&&poly.length>0&&
    pointInRing(p,poly[0])&&!poly.slice(1).some(hole=>pointInRing(p,hole)));
}
const area=ring=>{
  let sum=0;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++)
    sum+=ring[j][0]*ring[i][1]-ring[i][0]*ring[j][1];
  return Math.abs(sum)/2;
};
const scanline=(ring,y)=>{
  const intersections=[];
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>y)!==(b[1]>y))
      intersections.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));
  }
  intersections.sort((a,b)=>a-b);
  const candidates=[];
  for(let i=0;i+1<intersections.length;i+=2){
    if(intersections[i+1]>intersections[i])
      candidates.push({p:[(intersections[i]+intersections[i+1])/2,y],
        width:intersections[i+1]-intersections[i]});
  }
  return candidates;
};
export function interiorPoint(shape){
  const polys=geometryPolygons(shape)
    .filter(p=>Array.isArray(p)&&Array.isArray(p[0])&&p[0].length>=4)
    .sort((a,b)=>area(b[0])-area(a[0]));
  for(const polygon of polys){
    const ring=polygon[0],ys=ring.map(p=>p[1]);
    const bottom=Math.min(...ys),top=Math.max(...ys);
    const candidates=[];
    for(const fraction of [0.5,0.35,0.65,0.2,0.8,0.1,0.9])
      candidates.push(...scanline(ring,bottom+(top-bottom)*fraction));
    candidates.sort((a,b)=>b.width-a.width);
    for(const candidate of candidates){
      for(const places of [5,6,7]){
        const p=candidate.p.map(v=>Number(v.toFixed(places)));
        if(pointInsideMunicipality(p,shape))return p;
      }
    }
  }
  return null;
}
const idFor=feature=>{
  for(const v of [feature?.properties?.codarea,feature?.properties?.CD_MUN,
    feature?.properties?.CD_MUN7,feature?.properties?.codigo,feature?.id]){
    const text=String(v??'').trim();
    if(/^33\d{5}$/.test(text))return text;
  }
  return null;
};
export function prepareIbgeRjPoints(geojson,{checkedAt='2026-11-17T12:00:00.000Z'}={}){
  const known=new Set(RJ_MUNICIPALITIES.map(x=>x.ibge));
  if(geojson?.type!=='FeatureCollection'||!Array.isArray(geojson.features)||
    geojson.features.length!==92||known.size!==92)throw Error('IBGE_NOT_EXACTLY_92_MUNICIPALITIES');
  const results=[];
  for(const feature of geojson.features){
    const ibge=idFor(feature);
    if(!known.has(ibge)||results.some(x=>x.ibge===ibge))
      throw Error('IBGE_CODE_MISSING_DUPLICATED_OR_UNKNOWN');
    const p=RJ_VERIFIED_OLD_POINTS[ibge]&&
      pointInsideMunicipality(RJ_VERIFIED_OLD_POINTS[ibge],feature.geometry)
      ?RJ_VERIFIED_OLD_POINTS[ibge]:interiorPoint(feature.geometry);
    if(!p||!pointInsideMunicipality(p,feature.geometry)||
      p[0]<-46||p[0]>-40||p[1]<-25||p[1]>-20)
      throw Error('IBGE_INTERIOR_GEOGRAPHY_NOT_VERIFIED_'+ibge);
    results.push({
      ibge,lat:p[1],lon:p[0],verifiedByBackend:true,
      geometryStatus:'POINT_INSIDE_IBGE_MUNICIPAL_POLYGON',
      // Public geodata do not imply measured elevation; never insert 0.
      altitudeM:null,altitudeVerified:false
    });
  }
  if(new Set(results.map(x=>x.lat+','+x.lon)).size!==92)
    throw Error('DUPLICATED_GEOPOINTS');
  results.sort((a,b)=>a.ibge.localeCompare(b.ibge));
  return Object.freeze({
    contract:'BLAISE_RJ_IBGE_92_INTERIOR_POINTS_CANDIDATE_V1',
    state:'POLYGON_GEOMETRY_VERIFIED_ALTITUDE_UNVERIFIED',
    checkedAt,sourceUrl:IBGE_RJ_MALHAS_URL,
    municipalityCount:92,productionActivated:false,
    points:results
  });
}
async function getGeojson(fetchImpl=globalThis.fetch){
  const response=await fetchImpl(IBGE_RJ_MALHAS_URL,{
    method:'GET',redirect:'error',headers:{Accept:'application/geo+json,application/json'},
    signal:AbortSignal.timeout(25_000)
  });
  if(!response.ok||!response.body)throw Error('IBGE_HTTP_'+response.status);
  let bytes=0;const chunks=[];
  for await(const chunk of response.body){
    bytes+=chunk.length;
    if(bytes>12*1024*1024)throw Error('IBGE_GEOMETRY_TOO_LARGE');
    chunks.push(Buffer.from(chunk));
  }
  const input=Buffer.concat(chunks);
  return {geojson:JSON.parse(input.toString('utf8')),
    sha256:createHash('sha256').update(input).digest('hex'),bytes:input.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.argv.includes('--live')){
    console.error('Run --live explicitly; no IBGE request was made');
    process.exitCode=2;
  }else{
    try{
      const {geojson,sha256,bytes}=await getGeojson();
      const result=prepareIbgeRjPoints(geojson,{checkedAt:new Date().toISOString()});
      const evidence={...result,sourceSha256:sha256,sourceResponseBytes:bytes};
      const dir=new URL('../../evidence/ibge-92-points/',import.meta.url);
      await mkdir(dir,{recursive:true});
      await writeFile(new URL('../../evidence/ibge-92-points/rj-92-points.json',import.meta.url),
        JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
      console.log('BLAISE_IBGE_POINTS_JSON='+JSON.stringify(evidence));
    }catch(error){
      console.error('BLAISE_IBGE_POINTS_FAILED='+String(error?.message||error));
      process.exitCode=1;
    }
  }
}
