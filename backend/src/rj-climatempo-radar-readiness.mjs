/**
 * Climatempo radar + nowcasting candidate for Blaise V6 RJ.
 *
 * Public website radar or public examples are NOT an API or an embedding
 * license. Do not scrape, hotlink tiles, bypass access, or copy radar imagery.
 * Requiring 92 RJ municipalities + Atlantic coverage does not establish that
 * any sensor or contract actually covers those exact geographical polygons.
 */
export const RJ_CLIMATEMPO_RADAR_PLAN=Object.freeze({
  providerId:'CLIMATEMPO_ENTERPRISE_RADAR',
  status:'COMMERCIAL_QUOTE_REQUESTED_NO_CONTRACT',
  owner:'CLIMATEMPO',
  product:'RADAR_GEOREFERENCED_AND_NOWCAST_IF_LICENSED',
  procurement:'NOT_AUTHORIZED',
  providerUrl:'https://advisor.climatempo.com.br/',
  quotationRequestedAt:'2026-11-21',
  targetUpdateMinutes:2,
  acceptableUpdateWindowMinutes:5,
  maximumRadarFrameAgeMinutes:12,
  supportedProductTypes:Object.freeze(['RADAR_REFLECTIVITY_OBSERVED',
    'RADAR_DERIVED_RAIN_ESTIMATE',
    'NOWCAST_PRECIPITATION_FORECAST']),
  intendedRegions:'92 RJ MUNICIPALITIES + ADJACENT ATLANTIC',
  totalMunicipalCoverageVerified:false,
  atlanticCoverageVerified:false,
  commercialRjSubscriberLicenseGranted:false,
  permissionToEmbedOrRedistributeRadarTiles:false,
  publicRadarHttpClientEnabled:false,
  noWeatherKeyOrPaidProviderInAndroid:true,
  neverTreatRadarAsThermometer:true,
  neverTreatReflectivityAsObservedRainfallMm:true,
  backendCollectorActive:false,
  canEmitLevels4Or5:false,
});
const safeTime=(x,now)=>{
  const t=Date.parse(x);
  return Number.isFinite(t)&&t<=now&&now-t>=0&&now-t<=12*60_000;
};
export function assessRjClimatempoRadar({
  signedCommercialLicense=false,
  permissionToRenderInSubscriberApp=false,
  radarEndpointGranted=false,
  mapTilesGeoreferenced=false,
  coverage92Verified=false,
  adjacentAtlanticCoverageVerified=false,
  providerFrameTimestamp=null,
  backendCheckedAt=null,
  observedRadarType=null,
  nowMs=Date.now()
}={}){
  const reasons=[];
  if(signedCommercialLicense!==true)reasons.push('COMMERCIAL_RADAR_LICENSE_MISSING');
  if(permissionToRenderInSubscriberApp!==true)reasons.push('SUBSCRIBER_RENDERING_RIGHTS_MISSING');
  if(radarEndpointGranted!==true)reasons.push('RADAR_PROVIDER_ENDPOINT_NOT_GRANTED');
  if(mapTilesGeoreferenced!==true)reasons.push('RADAR_GEOREFERENCING_NOT_VERIFIED');
  if(coverage92Verified!==true)reasons.push('FULL_RJ_92_COVERAGE_NOT_VERIFIED');
  if(adjacentAtlanticCoverageVerified!==true)reasons.push('ATLANTIC_COVERAGE_NOT_VERIFIED');
  if(!['RADAR_REFLECTIVITY_OBSERVED','RADAR_DERIVED_RAIN_ESTIMATE'].includes(observedRadarType))
    reasons.push('RADAR_PRODUCT_SEMANTICS_NOT_VERIFIED');
  if(!Number.isSafeInteger(nowMs)||!safeTime(providerFrameTimestamp,nowMs)||
      !safeTime(backendCheckedAt,nowMs))reasons.push('RADAR_FRAME_OR_CHECK_TOO_OLD');
  return Object.freeze({
    sourceId:RJ_CLIMATEMPO_RADAR_PLAN.providerId,
    eligibleForSeparateOperationalReview:reasons.length===0,
    blockers:Object.freeze(reasons),
    // Readiness is not a purchase nor an authorization to publish.
    providerCallsExecuted:false,
    radarFramesDownloaded:false,
    releaseAuthorized:false,
    publishToCustomers:false,
    weatherAlertsAuthorized:false,
    thermometersSupported:false,
    noDirectAlertaRioIngestion:true
  });
}
