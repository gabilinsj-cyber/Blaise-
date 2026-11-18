/**
 * NOAA GFS atmospheric TMP at 2 m: explicit live scientific staging only.
 * Fetches one bounded GRIB2 subset from official NOMADS for an IBGE-validated
 * RJ point. Does not run automatically, write Firestore, or publish to clients.
 * All values are P (forecast), never observed station thermometer values.
 */
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import ibgePoints from './rj-ibge-92-points.json' with {type:'json'};
const run=promisify(execFile);
const points=new Map(ibgePoints.points.map(p=>[p.ibge,p]));
const HOUR=3_600_000, SIX=6*HOUR;
const host='https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl';
const pad=(n)=>String(n).padStart(3,'0');
const isoUtc=(day,time)=>{
  const d=String(day),h=String(time).padStart(4,'0');
  if(!/^20\d{6}$/.test(d)||!/^\d{4}$/.test(h))throw Error('GFS_TIME_INVALID');
  const iso=d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)+'T'+h.slice(0,2)+':'+h.slice(2)+':00.000Z';
  const at=Date.parse(iso);
  if(!Number.isFinite(at)||new Date(at).toISOString()!==iso)throw Error('GFS_TIME_INVALID');
  return at;
};
const unavailable=(reason,ibge,now)=>Object.freeze({
  contract:'RJ_NOAA_GFS_ATMOS_POINT_STAGING_V1',
  status:'UNAVAILABLE',reason,ibge,temperatureC:null,
  checkedAt:new Date(now).toISOString(),
  publishedToAndroid:false,productionChanged:false,officialObservation:false,
});
export function rjGfsPoint(ibge){
  const p=points.get(String(ibge));
  return p?.verifiedByBackend===true&&p.geometryStatus==='POINT_INSIDE_IBGE_MUNICIPAL_POLYGON'&&
    Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&
    p.lat>=-24&&p.lat<=-20&&p.lon>=-46&&p.lon<=-40
    ?Object.freeze({ibge:String(ibge),lat:p.lat,lon:p.lon}):null;
}
export function noaaGfsAtmosUrl(cycleMillis,forecastHour){
  if(!Number.isSafeInteger(cycleMillis)||cycleMillis<0||cycleMillis%SIX!==0||
     !Number.isInteger(forecastHour)||forecastHour<0||forecastHour>24||
     forecastHour%3!==0)throw Error('GFS_INVALID_CYCLE_OR_LEAD');
  const utc=new Date(cycleMillis).toISOString();
  const day=utc.slice(0,10).replaceAll('-',''),cycle=utc.slice(11,13);
  const url=new URL(host);
  url.searchParams.set('file','gfs.t'+cycle+'z.pgrb2.0p25.f'+pad(forecastHour));
  url.searchParams.set('dir','/gfs.'+day+'/'+cycle+'/atmos');
  url.searchParams.set('var_TMP','on');
  url.searchParams.set('lev_2_m_above_ground','on');
  url.searchParams.set('subregion','');
  url.searchParams.set('leftlon','-46');
  url.searchParams.set('rightlon','-40');
  url.searchParams.set('toplat','-20');
  url.searchParams.set('bottomlat','-24');
  return url.href;
}
export function gfsRecentCandidates(now){
  if(!Number.isSafeInteger(now)||now<0)throw Error('GFS_INVALID_CLOCK');
  const cycle=Math.floor(now/SIX)*SIX;
  return [0,1,2,3].map(n=>{
    const issued=cycle-n*SIX;
    const forecastHour=Math.floor((now-issued)/(3*HOUR))*3;
    return Object.freeze({issued,forecastHour,url:noaaGfsAtmosUrl(issued,forecastHour)});
  }).filter(x=>x.forecastHour<=24&&now-x.issued<24*HOUR);
}
async function boundedGrib(url,fetchImpl){
  const response=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok||!response.body)throw Error('GFS_HTTP_'+response.status);
  const chunks=[];let size=0;
  for await(const part of response.body){
    size+=part.length;
    if(size>600_000)throw Error('GFS_PAYLOAD_TOO_LARGE');
    chunks.push(Buffer.from(part));
  }
  const bytes=Buffer.concat(chunks);
  if(bytes.length<40||bytes.subarray(0,4).toString('ascii')!=='GRIB'||
    bytes[7]!==2||bytes.readBigUInt64BE(8)!==BigInt(bytes.length)||
    bytes.subarray(-4).toString('ascii')!=='7777')
    throw Error('GFS_GRIB2_INVALID');
  return bytes;
}
async function readGribTemperature(bytes,point){
  const dir=await mkdtemp(join(tmpdir(),'blaise-gfs-atmos-'));
  try{
    const file=join(dir,'atmos.grib2');await writeFile(file,bytes,{mode:0o600});
    const opts={timeout:15000,maxBuffer:65536};
    const raw=(await run('grib_get',['-p','shortName,typeOfLevel,level,units,dataDate,dataTime,validityDate,validityTime',file],opts)).stdout.trim();
    const m=raw.split(/\s+/);
    if(m.length!==8||!['2t','t2m'].includes(m[0])||m[1]!=='heightAboveGround'||
      m[2]!=='2'||!['K','kelvin'].includes(m[3]))throw Error('GFS_FIELD_METADATA_INVALID');
    // ecCodes grib_get -l already returns the nearest numeric value.
    // Combining -l with -p value caused the verified staging file to fail.
    let nearest;
    try {
      nearest=(await run('grib_get',['-l',point.lat+','+(point.lon+360)+',1',file],opts)).stdout.trim();
    } catch (error) {
      throw Error('GFS_NEAREST_FAILED_'+String(error?.stderr||error?.message||'UNKNOWN').slice(0,120));
    }
    if(!/^-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?$/.test(nearest))throw Error('GFS_NEAREST_INVALID');
    const kelvin=Number(nearest);
    if(!Number.isFinite(kelvin)||kelvin<200||kelvin>340)throw Error('GFS_KELVIN_INVALID');
    return Object.freeze({kelvin,issued:isoUtc(m[4],m[5]),valid:isoUtc(m[6],m[7])});
  }finally{await rm(dir,{recursive:true,force:true});}
}
export function validateNoaaGfsPoint(input,{point,issued,forecastHour,now,sourceUrl}={}){
  if(!point||!Number.isSafeInteger(now)||now<0||!input||
     input.issued!==issued||input.valid!==issued+forecastHour*HOUR||
     input.valid>now||now-input.valid>=3*HOUR||
     !Number.isFinite(input.kelvin)||input.kelvin<200||input.kelvin>340||
     !sourceUrl?.startsWith(host+'?'))
    return unavailable('INVALID_GFS_POINT_OR_STALE_MODEL',point?.ibge??null,now);
  const temp=Math.round((input.kelvin-273.15)*100)/100;
  if(temp < -60||temp>65)return unavailable('OUT_OF_RANGE',point.ibge,now);
  return Object.freeze({
    contract:'RJ_NOAA_GFS_ATMOS_POINT_STAGING_V1',
    status:'REAL_MODEL_POINT_VALIDATED',sourceId:'NOAA_GFS',
    datasetId:'GFS_0P25_TMP_2M',kind:'P',ibge:point.ibge,
    latitude:point.lat,longitude:point.lon,temperatureC:temp,unit:'°C',
    issuedAt:new Date(issued).toISOString(),
    validAt:new Date(input.valid).toISOString(),
    checkedAt:new Date(now).toISOString(),sourceUrl,
    publishedToAndroid:false,productionChanged:false,
    officialObservation:false,officialAlert:false,
  });
}
export async function probeNoaaGfsAtmosphericPoint({
  ibge='3304557',now=Date.now(),fetchImpl=globalThis.fetch,
  decode=readGribTemperature
}={}){
  const point=rjGfsPoint(ibge);
  if(!point||!Number.isSafeInteger(now)||now<0)return unavailable('INVALID_IBGE_OR_CLOCK',String(ibge),Date.now());
  let reason='NO_RECENT_VALID_GFS_PRODUCT';
  for(const candidate of gfsRecentCandidates(now)){
    try{
      const bytes=await boundedGrib(candidate.url,fetchImpl);
      const decoded=await decode(bytes,point);
      const result=validateNoaaGfsPoint(decoded,{point,issued:candidate.issued,
        forecastHour:candidate.forecastHour,now,sourceUrl:candidate.url});
      if(result.status==='REAL_MODEL_POINT_VALIDATED')return result;
      reason=result.reason;
    }catch(error){reason=String(error?.message||'FETCH_FAILED').slice(0,90);}
  }
  return unavailable(reason,point.ibge,now);
}
