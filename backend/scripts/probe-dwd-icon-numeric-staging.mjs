/**
 * Explicit one-shot read of a real DWD ICON GLOBAL 2m air temperature GRIB2.
 * Verifies file, parameter, unit, cycle, nearest RJ grid value if available.
 * If no verified coordinate exists, reports UNAVAILABLE, never a fake reading.
 * No production changes, only one file, no user GPS.
 */
import {writeFile,readFile,stat,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import geometry from '../src/rj-ibge-92-points.json' with {type:'json'};
import {regridDwdIconGlobalGrib} from '../src/rj-dwd-icon-regrid.mjs';
const exec=promisify(execFile);
const reference=geometry.points.find(x=>x.ibge==='3304557');
if(!reference||reference.verifiedByBackend!==true||
   reference.geometryStatus!=='POINT_INSIDE_IBGE_MUNICIPAL_POLYGON')
  throw Error('DWD_RJ_IBGE_REFERENCE_NOT_VERIFIED');
export const DWD_RJ_RESEARCH_POINT=Object.freeze({
  lat:reference.lat,lon:reference.lon,ibge:reference.ibge
});
// All 92 *verified IBGE polygon-interior* reference points. These are
// representative forecast cells, NOT 92 physical weather stations.
export const DWD_RJ_92_POINTS=Object.freeze(geometry.points.map(p=>{
  if(typeof p.ibge!=='string'||p.verifiedByBackend!==true||
     p.geometryStatus!=='POINT_INSIDE_IBGE_MUNICIPAL_POLYGON'||
     !Number.isFinite(p.lat)||!Number.isFinite(p.lon)||
     p.lat < -25||p.lat > -20||p.lon < -46||p.lon > -40)
    throw Error('DWD_RJ_MUNICIPALITY_GEOMETRY_INVALID');
  return Object.freeze({ibge:p.ibge,lat:p.lat,lon:p.lon});
}));
if(DWD_RJ_92_POINTS.length!==92||
   new Set(DWD_RJ_92_POINTS.map(p=>p.ibge)).size!==92)
  throw Error('DWD_RJ_92_INVENTORY_INVALID');
const ROOT='https://opendata.dwd.de/weather/nwp/icon/grib/';
const valid=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
const parseHttp=async(response,cap)=>{
  if(!response.ok||!response.body)throw Error('DWD_HTTP_'+response.status);
  const buffers=[];let size=0;
  for await(const chunk of response.body){
    size+=chunk.length;if(size>cap)throw Error('DWD_FILE_TOO_LARGE');
    buffers.push(Buffer.from(chunk));
  }
  return Buffer.concat(buffers);
};
export function identifyDwd2mCandidate(index,cycle,{now=Date.now()}={}){
  if(typeof index!=='string'||index.length>200000||
     !/^(00|06|12|18)$/.test(cycle))throw Error('DWD_INDEX_INVALID');
  const re=/href="(icon_global_icosahedral_single-level_(20\d{8})_(\d{3})_T_2M\.grib2\.bz2)"/g;
  const found=[];
  for(const m of index.matchAll(re)){
    const cyc=m[2],lead=Number(m[3]);
    if(cyc.slice(8)!==cycle||lead>36)continue;
    const issued=Date.parse(cyc.slice(0,4)+'-'+cyc.slice(4,6)+'-'+cyc.slice(6,8)+
      'T'+cyc.slice(8)+':00:00Z');
    const validAt=issued+lead*3600_000;
    if(Number.isFinite(issued)&&issued<=now&&now-issued<=24*3600_000&&
      validAt<=now&&now-validAt<=3*3600_000)
      found.push({file:m[1],cycle,issuedAt:new Date(issued).toISOString(),
        validAt:new Date(validAt).toISOString(),leadHours:lead});
  }
  found.sort((a,b)=>Date.parse(b.validAt)-Date.parse(a.validAt)||
    Date.parse(b.issuedAt)-Date.parse(a.issuedAt));
  return found[0]||null;
}
const no=(reason,checkedAt)=>Object.freeze({
  contract:'BLAISE_DWD_ICON_GLOBAL_RJ_NUMERIC_STAGING_V1',
  status:'UNAVAILABLE',reason,checkedAt,ibge:DWD_RJ_RESEARCH_POINT.ibge,
  valueC:null,publishedToAndroid:false,productionChanged:false,officialObservation:false
});
export async function probeDwdIconStaging({
  fetchImpl=globalThis.fetch,clock=()=>Date.now(),decode=null,
  municipalityCoverage=false
}={}){
  const at=clock(),checkedAt=new Date(at).toISOString();
  const candidates=[];
  for(const cycle of ['18','12','06','00']){
    try{
      const resp=await fetchImpl(ROOT+cycle+'/t_2m/',{
        method:'GET',redirect:'error',signal:AbortSignal.timeout(12_000),
        headers:{Accept:'text/html'}
      });
      const index=(await parseHttp(resp,180000)).toString('utf8');
      const found=identifyDwd2mCandidate(index,cycle,{now:at});
      if(found)candidates.push(found);
    }catch{/* Missing cycle is not evidence of zero or clear weather. */}
  }
  candidates.sort((a,b)=>Date.parse(b.validAt)-Date.parse(a.validAt)||
    Date.parse(b.issuedAt)-Date.parse(a.issuedAt));
  if(candidates.length===0)return no('NO_RECENT_GLOBAL_ICON_2M_FILE',checkedAt);
  const selection=candidates[0];
  const sourceUrl=ROOT+selection.cycle+'/t_2m/'+selection.file;
  const temp=await mkdtemp(join(tmpdir(),'blaise-dwd-staging-'));
  try{
    const payload=await parseHttp(await fetchImpl(sourceUrl,{
      method:'GET',redirect:'error',signal:AbortSignal.timeout(30_000),
      headers:{Accept:'application/octet-stream'}
    }),7*1024*1024);
    if(payload.subarray(0,3).toString('ascii')!=='BZh')
      return no('INVALID_BZIP2_PRODUCT',checkedAt);
    const bz=join(temp,selection.file);
    await writeFile(bz,payload);
    await exec('bzip2',['-dkf',bz],{timeout:25_000});
    const file=bz.slice(0,-4);
    const fileSize=(await stat(file)).size;
    if(fileSize>70*1024*1024||fileSize<64)
      return no('INVALID_GRIB2_FILE_SIZE',checkedAt);
    const head=await readFile(file);
    if(head.subarray(0,4).toString('ascii')!=='GRIB'||head[7]!==2)
      return no('INVALID_GRIB2_EDITION',checkedAt);
    const run=(command,args)=>exec(command,args,{timeout:30_000,maxBuffer:250000});
    const metadata=(await run('grib_get',['-p',
      'shortName,units,dataDate,dataTime,stepRange',file])).stdout.trim();
    const m=metadata.split(/\s+/);
    if(m.length!==5||!['2t','t2m'].includes(m[0])||
      !['K','kelvin'].includes(m[1])||
      !/^(20\d{6})$/.test(m[2])||
      !/^\d{1,4}$/.test(m[3])||!/^\d{1,3}$/.test(m[4]))
      return no('DWD_METADATA_NOT_CONFIRMED',checkedAt);
    const fromMeta=Date.parse(m[2].slice(0,4)+'-'+m[2].slice(4,6)+'-'+m[2].slice(6,8)+
      'T'+m[3].padStart(4,'0').slice(0,2)+':'+m[3].padStart(4,'0').slice(2)+'Z');
    if(fromMeta!==Date.parse(selection.issuedAt)||Number(m[4])!==selection.leadHours)
      return no('DWD_CYCLE_VALIDITY_MISMATCH',checkedAt);
    // ICON Global is an unstructured icosahedral mesh: its raw GRIB2 has no
    // directly usable point coordinates. Convert with DWD's official
    // precomputed CDO weights BEFORE querying an RJ nearest grid point.
    let grid;
    try{
      grid=await regridDwdIconGlobalGrib({
        originalFile:file,workspace:temp,fetchImpl
      });
    }catch(error){
      return Object.freeze({...no('DWD_OFFICIAL_REGRID_UNAVAILABLE_'+
        String(error?.message||'FAILED').slice(0,70),checkedAt),
        actualGribValidated:true,validAt:selection.validAt,sourceUrl});
    }
    if(municipalityCoverage===true){
      // One DWD GRIB2 download, one official regrid, 92 local ecCodes
      // nearest-grid lookups with 6 bounded workers; never 92 HTTP fetches.
      const verified=new Array(DWD_RJ_92_POINTS.length).fill(null);
      let cursor=0;
      await Promise.all(Array.from({length:6},async()=>{
        while(cursor<DWD_RJ_92_POINTS.length){
          const i=cursor++;
          const point=DWD_RJ_92_POINTS[i];
          try{
            const near=(await run('grib_get',['-l',
              point.lat+','+(point.lon+360)+',1',grid.file])).stdout.trim();
            if(!/^-?\\d+(?:\\.\\d+)?(?:[Ee][+-]?\\d+)?$/.test(near))continue;
            const kelvin=Number(near);
            if(!valid(kelvin,200,340))continue;
            const valueC=Math.round((kelvin-273.15)*100)/100;
            if(!valid(valueC,-60,65))continue;
            verified[i]=Object.freeze({
              ibge:point.ibge,latitude:point.lat,longitude:point.lon,
              valueC,unit:'°C',sourceId:'DWD_ICON_GLOBAL',kind:'P'
            });
          }catch{
            // A missing grid lookup is UNAVAILABLE, never zero or fabricated.
          }
        }
      }));
      const records=Object.freeze(verified.filter(Boolean));
      const missing=Object.freeze(DWD_RJ_92_POINTS.filter((_,i)=>!verified[i])
        .map(p=>p.ibge));
      return Object.freeze({
        contract:'BLAISE_DWD_ICON_GLOBAL_RJ_92_STAGING_V1',
        status:records.length===92?'FULL':records.length===0?'UNAVAILABLE':'PARTIAL',
        municipalityCount:92,verifiedMunicipalities:records.length,
        missingMunicipalities:missing.length,missingMunicipalityCodes:missing,
        records,sourceId:'DWD_ICON_GLOBAL',kind:'P',datasetId:'ICON_GLOBAL_2M',
        issuedAt:selection.issuedAt,validAt:selection.validAt,
        checkedAt:new Date(clock()).toISOString(),
        sourceUrl,metadata,gridResolutionDegrees:grid.gridResolutionDegrees,
        gridInterpolation:grid.interpolation,gridWeightsUrl:grid.weightsUrl,
        officialObservation:false,officialAlert:false,
        municipalityPointsNotPhysicalStations:true,
        networkDownloadsPerForecastGrid:1,
        publishedToAndroid:false,productionChanged:false,
        automaticCollection:false
      });
    }
    let locationValue=null,nearestInfo=null;
    try{
      // -l emits nearest gridpoint value; combining it with -p value
      // caused the previous ICON staging attempt to reject the point.
      const near=(await run('grib_get',['-l',
        DWD_RJ_RESEARCH_POINT.lat+','+(DWD_RJ_RESEARCH_POINT.lon+360)+',1',
        grid.file])).stdout.trim();
      if(/^-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?$/.test(near)){
        const kelvin=Number(near);
        if(valid(kelvin,200,340))locationValue=Number((kelvin-273.15).toFixed(2));
      }
      nearestInfo=near.slice(0,300);
    }catch(error){nearestInfo='ECCODES_NEAREST_FAILED';}
    if(locationValue===null)
      return Object.freeze({...no('LOCATION_UNVERIFIED_NEEDS_ICON_GRID_MAPPING',checkedAt),
        actualGribValidated:true,metadata,
        validAt:selection.validAt,sourceUrl});
    return Object.freeze({
      contract:'BLAISE_DWD_ICON_GLOBAL_RJ_NUMERIC_STAGING_V1',
      status:'DWD_MODEL_POINT_VALIDATED',ibge:DWD_RJ_RESEARCH_POINT.ibge,
      latitude:DWD_RJ_RESEARCH_POINT.lat,longitude:DWD_RJ_RESEARCH_POINT.lon,
      valueC:locationValue,unit:'°C',sourceId:'DWD_ICON_GLOBAL',kind:'P',
      issuedAt:selection.issuedAt,validAt:selection.validAt,checkedAt,
      sourceUrl,metadata,gridResolutionDegrees:grid.gridResolutionDegrees,
      gridInterpolation:grid.interpolation,
      gridWeightsUrl:grid.weightsUrl,
      officialObservation:false,officialAlert:false,
      publishedToAndroid:false,productionChanged:false
    });
  }catch(error){
    return no('DWD_EXTRACTION_FAILED_'+String(error?.message||'UNKNOWN').slice(0,70),
      checkedAt);
  }finally{await rm(temp,{recursive:true,force:true});}
}
export async function probeDwdIconStatewideStaging(opts={}){
  const result=await probeDwdIconStaging({...opts,municipalityCoverage:true});
  if(result.contract==='BLAISE_DWD_ICON_GLOBAL_RJ_92_STAGING_V1')return result;
  // Preserve original technical reason without accepting a stale/invalid grid.
  return Object.freeze({
    contract:'BLAISE_DWD_ICON_GLOBAL_RJ_92_STAGING_V1',
    status:'UNAVAILABLE',reason:result.reason??'DWD_SOURCE_UNAVAILABLE',
    municipalityCount:92,verifiedMunicipalities:0,missingMunicipalities:92,
    missingMunicipalityCodes:Object.freeze(DWD_RJ_92_POINTS.map(x=>x.ibge)),
    records:Object.freeze([]),sourceId:'DWD_ICON_GLOBAL',kind:'P',
    checkedAt:result.checkedAt??new Date().toISOString(),
    officialObservation:false,officialAlert:false,
    municipalityPointsNotPhysicalStations:true,
    publishedToAndroid:false,productionChanged:false,automaticCollection:false
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.argv.includes('--live')){
    console.error('--live required; no DWD download');process.exitCode=2;
  }else{
    const result=await probeDwdIconStaging();
    const dir=new URL('../../evidence/international-sources/',import.meta.url);
    await mkdir(dir,{recursive:true});
    await writeFile(new URL('../../evidence/international-sources/dwd-icon-rio.json',import.meta.url),
      JSON.stringify(result,null,2)+'\n',{mode:0o600});
    console.log('BLAISE_DWD_REAL_RESULT='+JSON.stringify(result));
  }
}
