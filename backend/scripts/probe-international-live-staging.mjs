/**
 * Explicit, low-cost STAGING probe: check only public product catalog pages.
 * This does not download meteorological values, schedule collection or change
 * production. MET Norway intentionally EXCLUDED (human ToS acceptance needed).
 *
 * CLI: node scripts/probe-international-live-staging.mjs --live
 * Output: one bounded JSON evidence record, no secrets/user/precise GPS.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

export const PROBE_TARGETS=Object.freeze([
  Object.freeze({
    id:'NOAA_GFS_WAVE',
    url:'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl',
    kind:'P',family:'NOAA_GFS_WAVE',
    pattern:/gfs\\.(20\\d{6})/g,format:'date'
  }),
  Object.freeze({
    id:'DWD_ICON_GLOBAL_T2M',
    url:'https://opendata.dwd.de/weather/nwp/icon/grib/00/t_2m/',
    kind:'P',family:'DWD_ICON',
    pattern:/icon_global_icosahedral_single-level_(20\\d{8})/g,format:'cycle'
  }),
  Object.freeze({
    id:'EUMETSAT_OSI_SAF_SST',
    url:'https://osi-saf.eumetsat.int/low-and-mid-latitudes-processing-center',
    kind:'E',family:'GOES_EAST_ABI',
    pattern:/OSI-207-c[^\\n\\r]{0,240}?(20\\d{6}\\s+\\d{2}:\\d{2})/ig,
    format:'production'
  }),
]);

const boundedUtc=(v,format)=>{
  const stamp=String(v).replace(/\\s+/g,' ').trim();
  if(format==='date'&&/^20\\d{6}$/.test(stamp))
    return Date.parse(stamp.slice(0,4)+'-'+stamp.slice(4,6)+'-'+stamp.slice(6,8)+'T00:00:00Z');
  if(format==='cycle'&&/^20\\d{8}$/.test(stamp))
    return Date.parse(stamp.slice(0,4)+'-'+stamp.slice(4,6)+'-'+stamp.slice(6,8)+'T'+stamp.slice(8,10)+':00:00Z');
  if(format==='production'&&/^20\\d{6} \\d{2}:\\d{2}$/.test(stamp))
    return Date.parse(stamp.slice(0,4)+'-'+stamp.slice(4,6)+'-'+stamp.slice(6,8)+'T'+stamp.slice(9)+':00Z');
  return NaN;
};

export function inspectLiveProductCatalog(target,html,{now=Date.now()}={}){
  if(!Number.isSafeInteger(now)||typeof html!=='string'||html.length>262144||
     !PROBE_TARGETS.some(x=>x.id===target?.id))throw Error('rj_probe_invalid_input');
  const regex=new RegExp(target.pattern.source,target.pattern.flags);
  const seen=[];
  for(const match of html.matchAll(regex)){
    const ms=boundedUtc(match[1],target.format);
    if(Number.isFinite(ms)&&ms<=now+60*60_000)seen.push(ms);
    if(seen.length>500)break;
  }
  if(seen.length===0)return Object.freeze({
    id:target.id,kind:target.kind,
    state:'NO_PRODUCT_TIMESTAMP_PROVEN',latestCatalogTimestamp:null,
    observation:false,value:null
  });
  const latest=Math.max(...seen);
  const age=now-latest;
  // Directory listing publication (not a decoded field) can lag one cycle.
  const maxAgeMs=target.format==='date'?48*60*60_000:
    target.format==='cycle'?36*60*60_000:12*60*60_000;
  return Object.freeze({
    id:target.id,kind:target.kind,
    state:age>=0&&age<=maxAgeMs?'RECENT_CATALOG':'STALE_CATALOG',
    latestCatalogTimestamp:new Date(latest).toISOString(),
    observation:false,value:null
  });
}

async function boundedHtml(response){
  if(!response.ok)throw Error('PROVIDER_HTTP_'+response.status);
  if(!response.body)throw Error('EMPTY_PROVIDER_RESPONSE');
  const parts=[];let size=0;
  for await(const chunk of response.body){
    size+=chunk.byteLength;
    if(size>262144)throw Error('CATALOG_RESPONSE_TOO_LARGE');
    parts.push(Buffer.from(chunk));
  }
  return Buffer.concat(parts).toString('utf8');
}
export async function probePublicCatalogs({fetchImpl=globalThis.fetch,clock=()=>Date.now()}={}){
  const checkedAt=clock();
  const rows=[];
  for(const target of PROBE_TARGETS){
    let row;
    try{
      // Strict host allowlist, GET only, short timeout, no redirect, no cookies.
      const url=new URL(target.url);
      if(url.protocol!=='https:'||![
        'nomads.ncep.noaa.gov','opendata.dwd.de','osi-saf.eumetsat.int'
      ].includes(url.hostname))throw Error('HOST_NOT_APPROVED');
      const response=await fetchImpl(target.url,{
        method:'GET',redirect:'error',
        headers:{Accept:'text/html', 'Cache-Control':'no-cache'},
        signal:AbortSignal.timeout(12_000)
      });
      const html=await boundedHtml(response);
      row=inspectLiveProductCatalog(target,html,{now:checkedAt});
    }catch(err){
      row=Object.freeze({id:target.id,kind:target.kind,
        state:'UNAVAILABLE',latestCatalogTimestamp:null,observation:false,
        value:null,reason:String(err?.message||'UNKNOWN').slice(0,72)});
    }
    rows.push(row);
  }
  return Object.freeze({
    contract:'BLAISE_RJ_STAGING_PUBLIC_CATALOG_PROBE_V1',
    checkedAt:new Date(checkedAt).toISOString(),
    scope:'ADMIN_STAGING_CATALOG_ONLY',
    metNorwayCalled:false,jaxaValuesDownloaded:false,
    modelValuesDecoded:false,publishedToAndroid:false,
    locationOrUserDataStored:false,
    results:Object.freeze(rows)
  });
}

if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  if(!process.argv.includes('--live')){
    console.error('Explicit --live required. No requests made.');
    process.exitCode=2;
  }else{
    const evidence=await probePublicCatalogs();
    const dir=fileURLToPath(new URL('../../evidence/international-sources/',import.meta.url));
    await mkdir(dir,{recursive:true});
    await writeFile(new URL('../../evidence/international-sources/catalog-probe.json',import.meta.url),
      JSON.stringify(evidence,null,2)+'\\n',{mode:0o600});
    console.log(JSON.stringify(evidence));
  }
}
