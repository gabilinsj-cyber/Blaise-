/**
 * Private Blaise V6 RJ maritime source audit. Wave forecast P over fixed
 * offshore points, not 92 onshore municipality observations.
 */
import {RJ_OFFSHORE_WAVE_POINTS} from './noaa-wave-marine-rj.mjs';
const ids=new Map(RJ_OFFSHORE_WAVE_POINTS.map(x=>[x.id,x]));
const FIELDS=Object.freeze({waveHeightM:[0,35],swellPeriodS:[0,40]});
const sourceOk=(url,field)=>{
 try{
  const u=new URL(url);
  const expected=field==='waveHeightM'?'HTSGW':'SWPER';
  return u.protocol==='https:'&&u.hostname==='nomads.ncep.noaa.gov'&&
   u.pathname==='/cgi-bin/filter_gfswave.pl'&&
   u.searchParams.get('var_'+expected)==='on'&&
   u.searchParams.get(field==='swellPeriodS'?
    'lev_1_in_sequence':'lev_surface')==='on'&&
   (field!=='swellPeriodS'||!u.searchParams.has('lev_surface'))&&
   !u.username&&!u.password;
 }catch{return false;}
};
export function verifyRjMarineAdminCoverage(proof,{
 now=Date.now(),noaaPublicDataLicenseReviewed=false
}={}){
 const empty=Object.freeze({
  contract:'BLAISE_RJ_MARINE_ADMIN_AUDIT_V1',
  status:'UNAVAILABLE',verifiedWaveHeightPoints:0,
  verifiedSwellPeriodPoints:0,records:Object.freeze([]),
  sourceId:'NOAA_GFS_WAVE',kind:'P',physicalObservation:false,
  publishedToSubscribers:false,alertLevelCreated:false
 });
 if(noaaPublicDataLicenseReviewed!==true||!Number.isSafeInteger(now)||now<0||
   proof?.contract!=='BLAISE_NOAA_RJ_MARINE_3_OFFSHORE_V1'||
   !['FULL','PARTIAL'].includes(proof.status)||
   proof.kind!=='P'||proof.sourceId!=='NOAA_GFS_WAVE'||
   proof.datasetId!=='GFS_WAVE_GLOBAL_0P25'||
   proof.physicalObservation!==false||proof.municipalityStations!==0||
   proof.publishedToAndroid!==false||proof.publishedToSubscriber!==false||
   proof.automaticCollection!==false||proof.points?.length!==3)
  return empty;
 const issued=Date.parse(proof.issuedAt),valid=Date.parse(proof.validAt),
   checked=Date.parse(proof.checkedAt);
 if(![issued,valid,checked].every(Number.isFinite)||
   issued>valid||valid>checked||checked>now||now-checked>12*60_000||
   now-valid>=60*60_000||now-issued>=12*60*60_000)
  return empty;
 for(const [field] of Object.entries(FIELDS)){
  const s=proof.sourceProducts?.[field];
  if(!s||typeof s.sourceUrl!=='string'||!sourceOk(s.sourceUrl,field))
   return empty;
  if(s.values?.length){
   if(s.issuedAt!==proof.issuedAt||s.validAt!==proof.validAt)return empty;
  }else if(s.state!=='UNAVAILABLE')return empty;
 }
 const seen=new Set(),rows=[];
 for(const p of proof.points){
  const official=ids.get(p?.id);
  if(!official||seen.has(p.id)||p.latitude!==official.latitude||
    p.longitude!==official.longitude)return empty;
  seen.add(p.id);
  for(const [field,[lo,hi]] of Object.entries(FIELDS)){
   const v=p.values?.[field],per=proof.sourceProducts[field];
   if(v===null)continue;
   if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi||
     !Array.isArray(per.values)||
     !per.values.some(q=>q.id===p.id&&q.value===v&&
       q.latitude===p.latitude&&q.longitude===p.longitude))
    return empty;
   rows.push(Object.freeze({
    id:p.id,latitude:p.latitude,longitude:p.longitude,field,
    value:v,unit:field==='waveHeightM'?'m':'s',sourceId:'NOAA_GFS_WAVE',
    datasetId:'GFS_WAVE_GLOBAL_0P25',category:'P',
    issuedAt:proof.issuedAt,validAt:proof.validAt,
    checkedAt:proof.checkedAt,sourceUrl:per.sourceUrl,
    commercialRightsReviewed:true,physicalObservation:false
   }));
  }
 }
 if(seen.size!==3)return empty;
 const h=rows.filter(x=>x.field==='waveHeightM').length;
 const sw=rows.filter(x=>x.field==='swellPeriodS').length;
 if(proof.verifiedFieldValues!==rows.length||
   (proof.status==='FULL')!==(rows.length===6))return empty;
 return Object.freeze({
  ...empty,status:rows.length===6?'FULL':rows.length>0?'PARTIAL':'UNAVAILABLE',
  verifiedWaveHeightPoints:h,verifiedSwellPeriodPoints:sw,
  records:Object.freeze(rows)
 });
}
