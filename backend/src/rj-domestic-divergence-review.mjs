/**
 * Blaise V6 RJ: internal-only geographically near Brazilian reference review.
 * INMET and CEMADEN NEVER supply values, alerts or other public app fields.
 * This pure helper does not fetch, save, schedule, trigger fallback or publish.
 */
const INTERNATIONAL=new Set([
  'DWD_ICON_GLOBAL','NOAA_GFS','ECMWF_IFS','INPE_CPTEC','JAXA_GSMAP',
  'EUMETSAT_SAT','NASA_SAT'
]);
const DOMESTIC=new Map([
  ['INMET',new Set(['temperatureC','humidityPct','windKmh','gustKmh','pressureHpa',
    'dewPointC','rainAccumulatedMm'])],
  ['CEMADEN',new Set(['rainNowMm','rainAccumulatedMm'])]
]);
const RJ_FIELD_UNITS=Object.freeze({
  temperatureC:'°C',humidityPct:'%',windKmh:'km/h',gustKmh:'km/h',
  pressureHpa:'hPa',dewPointC:'°C',rainNowMm:'mm',rainAccumulatedMm:'mm',
});
const FINITE=v=>typeof v==='number'&&Number.isFinite(v);
const checked=(str,now,ageMs)=>{
  const t=Date.parse(str);
  return typeof str==='string'&&Number.isFinite(t)&&t<=now&&now-t<=ageMs;
};
const point=p=>p&&FINITE(p.latitude)&&FINITE(p.longitude)&&
  p.latitude>=-90&&p.latitude<=90&&p.longitude>=-180&&p.longitude<=180;
const distanceKm=(a,b)=>{
  const rad=Math.PI/180;
  const dLat=(b.latitude-a.latitude)*rad;
  const dLon=(b.longitude-a.longitude)*rad;
  const x=Math.sin(dLat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dLon/2)**2;
  return 6371.0088*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));
};
const result=(state,more={})=>Object.freeze({
  contract:'RJ_ADMIN_DOMESTIC_DIVERGENCE_REVIEW_V1',
  scope:'ADMIN_ONLY',state,publishedToSubscriber:false,
  maySupplyBlaiseWeather:false,maySendAlerts:false,
  replacementWeatherValue:null,openWeatherAuthorized:false,...more
});

/**
 * An admin backend MUST create/verify records and pick the per-field threshold.
 * A source being nearby is insufficient: timestamps, unit and provenance matter.
 * Reference observations are never used as the selected app weather value.
 */
export function reviewRjInternationalDivergence({
  field,unit,location,internationalReadings=[],domesticReadings=[],
  discrepancyTolerance,maxNationalDistanceKm=400,now=Date.now()
}={}){
  if(!Object.hasOwn(RJ_FIELD_UNITS,field)||unit!==RJ_FIELD_UNITS[field]||
     !point(location)||!Number.isSafeInteger(now)||now<0||
     !FINITE(discrepancyTolerance)||discrepancyTolerance<=0||
     !FINITE(maxNationalDistanceKm)||maxNationalDistanceKm<=0||
     maxNationalDistanceKm>1000||!Array.isArray(internationalReadings)||
     !Array.isArray(domesticReadings))
    return result('INVALID_REQUEST');
  // Coordinates are chosen by server from a verified RJ location registry.
  if(location.municipalityGeoVerifiedByBackend!==true||
     location.latitude < -25||location.latitude > -20||
     location.longitude < -46||location.longitude > -40)
    return result('RJ_LOCATION_NOT_VERIFIED');

  const validInternational=internationalReadings.filter(r=>
    INTERNATIONAL.has(r?.sourceId)&&r.verifiedByBackend===true&&
    r.commercialUseAuthorized===true&&r.municipalityGeoVerified===true&&
    r.field===field&&r.unit===unit&&FINITE(r.value)&&
    ['O','E','P'].includes(r.nature)&&
    checked(r.checkedAt,now,12*60_000)&&
    // Product valid time must reasonably correspond to comparison target.
    checked(r.validAt,now,75*60_000)&&
    point(r)&&distanceKm(location,r)<=35
  );
  if(new Set(validInternational.map(r=>r.sourceId)).size<2)
    return result('INDEPENDENT_INTERNATIONAL_SOURCES_INSUFFICIENT');
  const latestBySource=new Map();
  for(const r of validInternational){
    const prev=latestBySource.get(r.sourceId);
    if(!prev||Date.parse(r.validAt)>Date.parse(prev.validAt))
      latestBySource.set(r.sourceId,r);
  }
  const international=[...latestBySource.values()];
  const values=international.map(x=>x.value);
  const spread=Math.max(...values)-Math.min(...values);
  if(spread<=discrepancyTolerance)
    return result('INTERNATIONAL_CONSISTENT',{
      internationalSourceCount:international.length,
      divergenceMagnitude:spread,unit,domesticLookupNeeded:false
    });

  // Query nearest licensed, geoverified Brazilian sensor for this field ONLY.
  // Country registry verification (not bounding-box inference) is mandatory.
  const references=domesticReadings.filter(r=>
    DOMESTIC.get(r?.sourceId)?.has(field)===true&&
    r.countryCode==='BR'&&r.countryVerifiedByBackend===true&&
    r.stationGeoVerifiedByBackend===true&&
    r.verifiedByBackend===true&&r.commercialUseAuthorized===true&&
    r.dataRole==='DIVERGENCE_COMPARISON_ONLY'&&
    r.field===field&&r.unit===unit&&FINITE(r.value)&&
    r.nature==='O'&&checked(r.validAt,now,12*60_000)&&
    checked(r.checkedAt,now,12*60_000)&&point(r)
  ).map(r=>({r,distance:distanceKm(location,r)}))
   .filter(x=>x.distance<=maxNationalDistanceKm)
   .sort((a,b)=>a.distance-b.distance);
  if(references.length===0)return result('DOMESTIC_COMPARATOR_NOT_AVAILABLE',{
    internationalSourceCount:international.length,divergenceMagnitude:spread,
    unit,domesticLookupNeeded:true
  });
  const closest=references[0];
  return result('DOMESTIC_CONTEXT_FOR_ADMIN_REVIEW',{
    internationalSourceCount:international.length,divergenceMagnitude:spread,
    unit,domesticLookupNeeded:true,
    // Internal-only metadata; never return this object to client APIs.
    comparisonSource:closest.r.sourceId,
    comparisonStation:closest.r.stationId??null,
    comparisonDistanceKm:Math.round(closest.distance*10)/10,
    comparisonValidAt:closest.r.validAt,
    comparisonReading:closest.r.value,
    decision:'REVIEW_ONLY_NO_OVERRIDE'
  });
}
