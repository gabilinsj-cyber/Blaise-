/**
 * Blaise V6 RJ — research-only outside networks, 17/11/2026.
 * NO API calls, credentials, live ingestion, subscriber publishing or
 * acceptance of commercial licence. None of these sources are authorized.
 */
const candidate=(id,displayName,url,role,transport,measurementKinds,restrictions)=>Object.freeze({
  id,displayName,url,role,transport,
  measurementKinds:Object.freeze([...measurementKinds]),
  restrictions:Object.freeze([...restrictions]),
  writtenCommercialPermissionVerified:false,
  sourceCredentialsVerified:false,
  activeRjStationInventoryVerified:false,
  liveIngestionConfirmed:false,
  publishedToSubscribers:false,
});
export const RJ_OUTSIDE_OBSERVATION_CANDIDATES=Object.freeze([
  candidate('WEATHER_UNDERGROUND_PWS','Weather Underground PWS',
    'https://www.wunderground.com/wundermap','PWS_GROUND_OBSERVATION',
    'RESTRICTED_PWS_API',
    ['temperatureC','humidityPct','pressureHpa','windKmh','gustKmh',
      'rainNowMm','rainAccumulatedMm'],
    ['COMMERCIAL_WRITTEN_AGREEMENT_REQUIRED',
      'PWS_QC_STATUS_AND_STATION_ID_REQUIRED',
      'RAIN_REQUIRES_REAL_GAUGE_AND_AGE_AT_MOST_30_MINUTES']),
  candidate('AMBIENT_WEATHER_NETWORK','Ambient Weather Network',
    'https://ambientweather.net/','PWS_GROUND_OBSERVATION',
    'USER_CONSENTED_API_KEY_PER_DEVICE',
    ['temperatureC','humidityPct','pressureHpa','windKmh','gustKmh',
      'rainNowMm','rainAccumulatedMm'],
    ['APPLICATION_AND_USER_API_KEY_REQUIRED',
      'COMMERCIAL_DATA_RIGHTS_NOT_VERIFIED',
      'PUBLIC_STATION_MAP_IS_NOT_BLANKET_API_CONSENT']),
  candidate('WEATHERCLOUD','Weathercloud',
    'https://app.weathercloud.net/map','PWS_VISUAL_RESEARCH_ONLY',
    'NO_OFFICIAL_RETRIEVAL_API',
    [],
    ['PRIOR_WRITTEN_CONSENT_FOR_THIRD_PARTY_APPLICATIONS',
      'NO_SCRAPING_NO_UNAUTHORIZED_API_CLIENT']),
]);
export const RJ_OBSERVATION_INTEGRATION_GATE=Object.freeze({
  scope:'ADMIN_REVIEW_ONLY',
  rainfallObservationMaximumAgeMinutes:30,
  actualStationMeasurementsOnly:true,
  heatIndexWindChillFeelsLikeAndDewPointMayBeDerived:true,
  derivedFieldsMustNotBeLabeledDirectSensorObservations:true,
  requireVerifiedStationGeolocation:true,
  requireSensorInventoryAndQualityControl:true,
  requireTimestampAndAcquisitionLag:true,
  requireCommercialRedistributionPermission:true,
  requireCrossPlatformHardwareDeduplication:true,
  requirePerMunicipalityEvidenceFor92Cities:true,
  noNetworkCredentialsInAndroid:true,
  currentCandidateCountForLiveProduction:0,
  automaticNetworkPolling:false,
  publishToClient:false,
  missingValue:'UNAVAILABLE',
});
