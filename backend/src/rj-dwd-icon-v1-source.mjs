/**
 * DWD Open Data v1 ICON Global single-field T_2M run/lead discovery.
 * The v1 address uses official ISO UTC run segments and uncompressed GRIB2.
 * Strict extraction from fixed DWD directory indexes prevents arbitrary URLs.
 */
export const DWD_ICON_V1_T2M_ROOT=
  'https://opendata.dwd.de/weather/nwp/v1/m/icon/p/T_2M/r/';
export const DWD_ICON_LEGACY_SUNSET_UTC=Date.UTC(2026,11,1,0,0,0);
const HOUR_MS=3600_000;
const RUN=/^20\d\d-\d\d-\d\dT(?:00|06|12|18):00$/;
const fileName=(hours,minutes=0)=>
  'PT'+String(hours).padStart(3,'0')+'H'+String(minutes).padStart(2,'0')+'M.grib2';
export function buildDwdIconV1Url(issuedAt,leadHours,leadMinutes=0){
  if(typeof issuedAt!=='string'||!RUN.test(issuedAt)||
    !Number.isInteger(leadHours)||leadHours<0||leadHours>36||
    leadMinutes!==0||!Number.isFinite(Date.parse(issuedAt+'Z')))
    throw Error('DWD_V1_RUN_OR_STEP_INVALID');
  const stamp=Date.parse(issuedAt+'Z');
  if(new Date(stamp).toISOString().slice(0,16)!==issuedAt)
    throw Error('DWD_V1_RUN_OR_STEP_INVALID');
  return DWD_ICON_V1_T2M_ROOT+encodeURIComponent(issuedAt)+
    '/s/'+fileName(leadHours,leadMinutes);
}
export function parseDwdIconV1RunIndex(html,{now=Date.now()}={}){
  if(typeof html!=='string'||html.length>140_000||
    !Number.isSafeInteger(now)||now<0)return Object.freeze([]);
  const seen=new Set(),out=[];
  const pattern=/href=["'](20\d{2}-\d\d-\d\dT(?:00|06|12|18)(?::|%3A)00)\/["']/gi;
  for(const match of html.matchAll(pattern)){
    const iso=match[1].replace(/%3A/ig,':');
    const issued=Date.parse(iso+'Z');
    if(!RUN.test(iso)||!Number.isFinite(issued)||
       new Date(issued).toISOString().slice(0,16)!==iso||
       issued>now||now-issued>30*HOUR_MS||seen.has(iso))continue;
    seen.add(iso);out.push(Object.freeze({
      issuedAt:new Date(issued).toISOString(),
      issuedMillis:issued,runToken:iso,
      directoryUrl:DWD_ICON_V1_T2M_ROOT+encodeURIComponent(iso)+'/s/'
    }));
  }
  return Object.freeze(out.sort((a,b)=>b.issuedMillis-a.issuedMillis).slice(0,6));
}
export function selectDwdIconV1Step(html,run,{now=Date.now()}={}){
  if(typeof html!=='string'||html.length>240_000||
    !RUN.test(run?.runToken||'')||
    !Number.isSafeInteger(now)||now<0)return null;
  const seen=new Set(),choices=[];
  const pattern=/href=["']PT(\d{3})H(\d{2})M\.grib2["']/g;
  for(const match of html.matchAll(pattern)){
    const hrs=Number(match[1]),mins=Number(match[2]);
    if(hrs>36||mins!==0||seen.has(hrs))continue;
    const valid=run.issuedMillis+hrs*HOUR_MS;
    if(valid>now||now-valid>=3*HOUR_MS||valid<run.issuedMillis)continue;
    seen.add(hrs);
    choices.push(Object.freeze({
      issuedAt:run.issuedAt,
      validAt:new Date(valid).toISOString(),
      leadHours:hrs,
      sourceUrl:buildDwdIconV1Url(run.runToken,hrs),
      fileName:fileName(hrs)
    }));
  }
  return choices.sort((a,b)=>Date.parse(b.validAt)-Date.parse(a.validAt))[0]??null;
}
export async function discoverDwdIconV1Forecast(fetchIndex,{now=Date.now()}={}){
  const runs=parseDwdIconV1RunIndex(await fetchIndex(DWD_ICON_V1_T2M_ROOT),{now});
  const choices=[];
  // One directory listing per recent run, no file downloads to discover.
  for(const run of runs){
    try{
      const choice=selectDwdIconV1Step(await fetchIndex(run.directoryUrl),run,{now});
      if(choice)choices.push(choice);
    }catch{/* A missing directory is not a zero temperature. */}
  }
  return choices.sort((a,b)=>Date.parse(b.validAt)-Date.parse(a.validAt)||
    Date.parse(b.issuedAt)-Date.parse(a.issuedAt))[0]??null;
}
