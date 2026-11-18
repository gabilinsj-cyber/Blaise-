/**
 * Coastal RJ wave/swell model staging. NOAA NOMADS GFS-Wave forecast ONLY.
 * Two bounded official GRIB2 field downloads per valid cycle, three fixed
 * offshore scientific reference points. No user location or customer data.
 */
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fetchNoaaGrib,noaaWaveUrl,noaaWaveCycles} from './noaa-wave-collector.mjs';
import {marineGribUtc} from './marine-grib-reader.mjs';
const exec=promisify(execFile),HOUR=3600000;
export const RJ_OFFSHORE_WAVE_POINTS=Object.freeze([
  Object.freeze({id:'ILHA_GRANDE_OFFSHORE',latitude:-23.4,longitude:-44.5,
    label:'Ilha Grande — alto-mar'}),
  Object.freeze({id:'RIO_OFFSHORE',latitude:-23.5,longitude:-43.25,
    label:'Rio de Janeiro — alto-mar'}),
  Object.freeze({id:'CABO_FRIO_OFFSHORE',latitude:-23.25,longitude:-42.0,
    label:'Cabo Frio — alto-mar'}),
]);
const FIELD=Object.freeze({
  waveHeightM:Object.freeze({parameter:'HTSGW',unit:'m',
    shortNames:Object.freeze(['swh']),min:0,max:35}),
  swellPeriodS:Object.freeze({parameter:'SWPER',unit:'s',
    shortNames:Object.freeze(['swper','swp','mpts']),min:0,max:40}),
});
export function noaaRjMarineFieldUrl(cycleMillis,hour,field){
  const spec=FIELD[field];
  if(!spec||!Number.isSafeInteger(cycleMillis)||cycleMillis<0||
     cycleMillis%(6*HOUR)!==0||!Number.isInteger(hour)||hour<0||hour>24)
    throw Error('NOAA_RJ_MARINE_CYCLE_OR_FIELD_INVALID');
  const u=new URL(noaaWaveUrl(cycleMillis,hour));
  u.searchParams.delete('var_HTSGW');
  u.searchParams.delete('lev_surface');
  // SWPER is NOT at surface: primary swell is GRIB2 "1 in sequence".
  // Requesting SWPER at surface returns an empty/invalid NOMADS subset.
  u.searchParams.set(field==='swellPeriodS'?
    'lev_1_in_sequence':'lev_surface','on');
  u.searchParams.set('var_'+spec.parameter,'on');
  return u.href;
}
const unavailable=(reason,now)=>Object.freeze({
  contract:'BLAISE_NOAA_RJ_MARINE_3_OFFSHORE_V1',status:'UNAVAILABLE',
  checkedAt:new Date(now).toISOString(),reason,
  sourceId:'NOAA_GFS_WAVE',datasetId:'GFS_WAVE_GLOBAL_0P25',
  kind:'P',physicalObservation:false,municipalityStations:0,
  points:Object.freeze([]),publishedToAndroid:false,
  publishedToSubscriber:false,automaticCollection:false
});
export async function readMarineFieldFile(file,field,points=RJ_OFFSHORE_WAVE_POINTS){
  const spec=FIELD[field];
  if(!spec||typeof file!=='string'||!file.startsWith('/'))
    throw Error('NOAA_RJ_MARINE_FIELD_INVALID');
  const opts={timeout:15000,maxBuffer:65536};
  const metadata=(await exec('grib_get',['-p',
    'shortName,units,dataDate,dataTime,validityDate,validityTime',file],opts)).stdout.trim();
  const parts=metadata.split(/\s+/);
  if(parts.length!==6||!spec.shortNames.includes(parts[0].toLowerCase())||
     parts[1]!==spec.unit)throw Error('NOAA_RJ_MARINE_METADATA_MISMATCH_'+field);
  const issued=marineGribUtc(parts[2],parts[3]);
  const valid=marineGribUtc(parts[4],parts[5]);
  if(Date.parse(valid)<Date.parse(issued))throw Error('NOAA_RJ_MARINE_TIME_INVALID');
  const values=[];
  for(const p of points){
    if(!RJ_OFFSHORE_WAVE_POINTS.some(v=>v.id===p.id&&v.latitude===p.latitude&&
       v.longitude===p.longitude))throw Error('NOAA_RJ_MARINE_POINT_UNVERIFIED');
    let value=null;
    try{
      const near=(await exec('grib_get',['-l',
        p.latitude+','+(p.longitude+360)+',1',file],opts)).stdout.trim();
      if(/^-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?$/.test(near)){
        const v=Number(near);
        if(Number.isFinite(v)&&v>=spec.min&&v<=spec.max)
          value=Math.round(v*100)/100;
      }
    }catch{/* A missing ocean cell is not a zero measurement. */}
    values.push(Object.freeze({id:p.id,latitude:p.latitude,
      longitude:p.longitude,field,value,unit:spec.unit}));
  }
  return Object.freeze({issuedAt:issued,validAt:valid,values:Object.freeze(values)});
}
export async function probeNoaaRjMarine({
  now=Date.now(),fetchImpl=globalThis.fetch,
  downloader=fetchNoaaGrib,reader=readMarineFieldFile
}={}){
  if(!Number.isSafeInteger(now)||now<0)return unavailable('INVALID_CLOCK',Date.now());
  let reason='NO_RECENT_NOAA_WAVE_PRODUCT';
  for(const cycleMillis of noaaWaveCycles(now)){
    if(now-cycleMillis>=12*HOUR)continue;
    const hour=Math.floor((now-cycleMillis)/HOUR);
    const results={};let hadOne=false;
    const dir=await mkdtemp(join(tmpdir(),'blaise-marine-rj-'));
    try{
      for(const field of Object.keys(FIELD)){
        const sourceUrl=noaaRjMarineFieldUrl(cycleMillis,hour,field);
        try{
          const data=await downloader(sourceUrl,fetchImpl);
          if(!Buffer.isBuffer(data)||data.length<20||
             data.subarray(0,4).toString('ascii')!=='GRIB'||
             data[7]!==2||data.readBigUInt64BE(8)!==BigInt(data.length)||
             data.subarray(-4).toString('ascii')!=='7777')
            throw Error('GRIB2_CONTENT_INVALID');
          const file=join(dir,field+'.grib2');
          await writeFile(file,data,{mode:0o600});
          const values=await reader(file,field);
          if(Date.parse(values.issuedAt)!==cycleMillis||
             Date.parse(values.validAt)!==cycleMillis+hour*HOUR||
             now-Date.parse(values.validAt)>=HOUR||
             Date.parse(values.validAt)>now)
            throw Error('FORECAST_CYCLE_NOT_FRESH');
          results[field]=Object.freeze({...values,sourceUrl});
          hadOne=true;
        }catch(e){
          results[field]=Object.freeze({values:[],sourceUrl,
            state:'UNAVAILABLE',reason:String(e?.message||'FIELD_FAILED').slice(0,85)});
        }
      }
      if(!hadOne){
        reason=Object.values(results).map(x=>x.reason||'').join(';').slice(0,170);
        continue;
      }
      const points=RJ_OFFSHORE_WAVE_POINTS.map(p=>{
        const values={};
        for(const field of Object.keys(FIELD)){
          const row=results[field]?.values?.find(x=>x.id===p.id);
          values[field]=row?.value??null;
        }
        return Object.freeze({id:p.id,label:p.label,
          latitude:p.latitude,longitude:p.longitude,
          values:Object.freeze(values)});
      });
      const verified=points.reduce((n,p)=>n+Object.values(p.values)
        .filter(v=>v!==null).length,0);
      return Object.freeze({
        contract:'BLAISE_NOAA_RJ_MARINE_3_OFFSHORE_V1',
        status:verified===6?'FULL':verified>0?'PARTIAL':'UNAVAILABLE',
        checkedAt:new Date(now).toISOString(),issuedAt:new Date(cycleMillis).toISOString(),
        validAt:new Date(cycleMillis+hour*HOUR).toISOString(),
        sourceId:'NOAA_GFS_WAVE',datasetId:'GFS_WAVE_GLOBAL_0P25',
        kind:'P',physicalObservation:false,municipalityStations:0,
        verifiedFieldValues:verified,expectedFieldValues:6,
        points:Object.freeze(points),sourceProducts:Object.freeze(results),
        publishedToAndroid:false,publishedToSubscriber:false,
        automaticCollection:false
      });
    }finally{await rm(dir,{recursive:true,force:true});}
  }
  return unavailable(reason,now);
}
