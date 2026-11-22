/**
 * Blaise V6 RJ | evidence-constrained meteorological production gate.
 *
 * Internal QA of parsers or a single private observation is not production
 * homologation. Pure read-only code: no provider HTTP, secrets, Firestore,
 * billing, scheduler, subscriber data, cloud deploy or alert publication.
 *
 * This baseline deliberately does NOT authorize client publication, even if
 * a caller supplies flags. Updating evidence requires a separate reviewed PR,
 * signed operational proof, license verification and release approval.
 */
import {RJ_SOURCE_SECTOR_MATRIX,RJ_SOURCE_MATRIX_POLICY}
 from './rj-source-sector-matrix.mjs';
import {METEOBLUE_FREE_PUBLICATION_CONTRACT}
 from './rj-meteoblue-free-publication-contract.mjs';

const record=(id,category,evidence,gaps)=>Object.freeze({
 id,category,evidence,productionEvidence:'NOT_ESTABLISHED',
 blockers:Object.freeze([...gaps]),clientPublicationAuthorized:false
});
export const RJ_METEOROLOGICAL_SOURCE_AUDIT=Object.freeze([
 record('MET_NORWAY_ECMWF','P','FORECAST_ADAPTER_PRESENT',
   ['CURRENT_RJ_FRESHNESS_AND_COVERAGE_NOT_INDEPENDENTLY_PROVED','ATTRIBUTION_USER_AGENT_AND_LICENCE_RELEASE_REVIEW']),
 record('DWD_ICON_92','P','ONE_REAL_DWD_V1_CYCLE_20261121_92_OF_92_LEGACY_CDO_WEIGHTS',
   ['OFFICIAL_CDO_GRID_WEIGHTS_AND_V1_CYCLE_VERIFICATION','LIVE_92_MUNICIPALITY_FRESHNESS_NOT_PROVED','PUBLIC_RELEASE_AND_ATTRIBUTION_REVIEW']),
 record('NOAA_GFS_ATMOS','P','PRIVATE_GRIB_STAGING',
   ['OPERATIONAL_RUN_CYCLE_AND_92_CITY_GRID_QA','CLIENT_INTEGRATION_NOT_PROVED']),
 record('NOAA_GFS_WAVE','P','ONE_REAL_NOAA_GFS_WAVE_CYCLE_20261121_THREE_OFFSHORE_POINTS',
   ['CURRENT_FILE_AND_CYCLE_AND_PRODUCT_QA','OFFSHORE_GEOGRAPHY_AND_CUSTOMER_PUBLICATION_REVIEW']),
 record('NOAA_GOES19_GLM','O','ONE_REAL_GLM19_FILE_20261121_242_VALID_FLASHES_ZERO_RJ_RECTANGLE',
   ['REAL_TIME_LATENCY_COVERAGE_AND_FLASH_QA','ALERT_SAFETY_AND_RELEASE_NOT_PROVED']),
 record('NOAA_COASTWATCH_SST','E','NOAA_GOES19_SST_20261121_NO_RECENT_FILE_ZERO_VERIFIED',
   ['CURRENT_NETCDF_HIGH_QA_PIXELS_AND_THREE_OFFSHORE_POINTS','CLIENT_LICENSE_ATTRIBUTION_AND_RELEASE_REVIEW']),
 record('METEOBLUE_FREE_BASIC6H','P','ONE_REAL_7_FIELD_29_SLOT_PRIVATE_FORECAST',
   ['CONVECTIVE_RAIN_29_PAIRS_SEMANTICS_PENDING','EXPOSED_API_KEY_NOT_ROTATED','PAID_SUBSCRIBER_REDISTRIBUTION_CACHE_AND_ATTRIBUTION_NOT_VERIFIED','92_CITY_COVERAGE_NOT_PROVED']),
 record('OPENWEATHER_AGENT13','E','OPTIONAL_CONDITIONAL_COLLECTOR_WITH_QUOTA',
   ['REAL_CURRENT_TEMPERATURE_AND_FEELS_LIKE_QA','KEY_LICENSE_FRESHNESS_AND_OPERATOR_APPROVAL','RECURRENCE_AND_RELEASE_NOT_PROVED']),
 record('HG_BRASIL_PRO','E/P','WRITTEN_DISPLAY_PERMISSION_PLAN_NOT_CONTRACTED',
   ['PAID_PLAN_NOT_CONTRACTED_BY_DESIGN','KEY_AND_REAL_API_RESPONSE_ABSENT','FIELD_LEVEL_STATION_PROVENANCE_UNAVAILABLE']),
 record('VISUAL_CROSSING_FREE','E/P','ONE_REAL_PRIVATE_PROBE_WITHOUT_92_CITY_CACHE',
   ['EXPOSED_KEY_AND_ACCOUNT_DAILY_USAGE_UNRECONCILED','92_CITY_ROLLOUT_PRIVATE_ONLY','FRESHNESS_ATTRIBUTION_AND_CLIENT_RELEASE_NOT_PROVED']),
 record('WEATHERAPI_FREE','E/P','QUOTA_AND_LICENSE_OFFLINE_FEASIBILITY_ONLY',
   ['NO_ACCOUNT_KEY_OR_REAL_PROVIDER_RESPONSE','NO_MONTHLY_ATOMIC_LEDGER_OR_92_CITY_LIVE_QA','ATTRIBUTION_AND_RELEASE_NOT_PROVED']),
 record('CLIMATEMPO_ADVISOR','O/E/P','QUOTE_REQUESTED_NOT_CONTRACTED',
   ['NO_CONTRACT_KEY_REAL_DATA_OR_LICENSE']),
 record('ECMWF_WAVE','P','SECTOR_CANDIDATE',
   ['OPEN_PRODUCT_ENDPOINT_AND_LICENSE_NOT_PROVED','REAL_RJ_OFFSHORE_VALIDATION_ABSENT']),
 record('CAMS_UV_VIA_MET_NORWAY','P','CLEAR_SKY_UV_FORECAST_EXCEPTION_ONLY',
   ['CLOUD_ADJUSTED_UV_OBSERVATION_NOT_SUPPORTED','EXCEPTION_LICENSE_AND_FRESHNESS_NOT_RELEASE_APPROVED']),
 record('CEMADEN_RJ','O','INTERNAL_COMPARISON_AND_RISK_SOURCE_CONTRACT',
   ['OPERATIONAL_FRESHNESS_AND_STATION_PROVENANCE_NOT_PROVED','P0_PROMOTION_NOT_IMPLEMENTED','NOT_APPROVED_AS_CLIENT_NUMERIC_FEED']),
 record('INMET','O','INTERNAL_COMPARISON_ONLY',
   ['NO_DIRECT_CLIENT_INGESTION_AUTHORIZED_OR_RELEASED']),
 record('ANA_SGB_SACE','O','RIVER_STATION_CANDIDATES',
   ['STATION_API_ACCESS_AND_RIGHTS_NOT_PROVED','NO_RJ_LIVE_WATER_LEVEL_FRESHNESS']),
 record('ALERTA_RIO_DEFESA_CIVIL','REFERRAL','LINK_ONLY_OFFICIAL_ADVISORIES',
   ['NOT_AN_AUTHORIZED_METEOROLOGICAL_MEASUREMENT_FEED','NO_P0_AUTOMATIC_ALERT_PROMOTION']),
 record('RAMMB_CIRA_SLIDER','O','EXTERNAL_VISUAL_GOES19_LINK_ONLY',
   ['NO_MAP_INGESTION_COPY_OR_NUMERIC_EXTRACTION_LICENSE']),
]);
const requiredSectors=Object.freeze([
 'AIR_TEMPERATURE','THERMAL_SENSATION','AIR_PRESSURE_HUMIDITY',
 'WIND_GUST','RAIN_NEXT_HOUR','METEOBLUE_FREE_FORECAST_6H',
 'SATELLITE_VISUAL_RJ','SATELLITE_VISUAL_ATLANTIC','CLOUDS',
 'CYCLONE_LAND','CYCLONE_OCEAN','WAVES_SWELL','SST',
 'CLEAR_SKY_UV','LIGHTNING','RIVERS_FLOODS'
]);

export function assessRjMeteorologicalProductionReadiness(){
 const actualSectors=RJ_SOURCE_SECTOR_MATRIX.map(x=>x.id);
 const missingSectors=requiredSectors.filter(x=>!actualSectors.includes(x));
 const unexpectedLiveProducts=RJ_SOURCE_SECTOR_MATRIX.flatMap(
  s=>s.products.filter(p=>p.liveIngestionConfirmed===true||
       p.validatedRjCoverage===true).map(p=>s.id+':'+p.productId));
 const excluded=new Set(RJ_SOURCE_MATRIX_POLICY.expresslyExcludedDirectSources);
 const activeExcluded=RJ_SOURCE_SECTOR_MATRIX.flatMap(s=>
  s.products.filter(p=>excluded.has(p.sourceId)).map(p=>s.id+':'+p.sourceId));
 const policyFailures=[];
 if(RJ_SOURCE_MATRIX_POLICY.automaticCollection!==false)
  policyFailures.push('GENERAL_AUTOMATIC_COLLECTION_MUST_REMAIN_OFF');
 if(RJ_SOURCE_MATRIX_POLICY.publishedToAndroid!==false)
  policyFailures.push('GENERAL_CLIENT_PUBLICATION_MUST_REMAIN_OFF');
 if(RJ_SOURCE_MATRIX_POLICY.notLiveCollection!==true)
  policyFailures.push('SOURCE_REGISTRY_MUST_NOT_CLAIM_LIVE_COLLECTION');
 if(METEOBLUE_FREE_PUBLICATION_CONTRACT.publicReleaseApproved!==false||
    METEOBLUE_FREE_PUBLICATION_CONTRACT.subscriberApiEnabled!==false||
    METEOBLUE_FREE_PUBLICATION_CONTRACT.androidPublicationEnabled!==false)
  policyFailures.push('METEOBLUE_PRIVATE_PUBLICATION_GATE_BYPASSED');
 if(missingSectors.length)policyFailures.push('REQUIRED_SECTOR_MISSING');
 if(unexpectedLiveProducts.length)policyFailures.push('UNVERIFIED_PRODUCT_CLAIMS_LIVE');
 if(activeExcluded.length)policyFailures.push('EXCLUDED_DIRECT_SOURCE_PRESENT');
 if(RJ_METEOROLOGICAL_SOURCE_AUDIT.some(x=>x.clientPublicationAuthorized))
  policyFailures.push('UNVERIFIED_SOURCE_RELEASE_AUTHORIZED');

 const allSources=RJ_METEOROLOGICAL_SOURCE_AUDIT.map(s=>Object.freeze({
   id:s.id,category:s.category,evidence:s.evidence,
   productionEvidence:s.productionEvidence,blockers:s.blockers,
   clientPublicationAuthorized:s.clientPublicationAuthorized
 }));
 return Object.freeze({
  status:policyFailures.length
    ?'SOURCE_POLICY_INTEGRITY_FAILURE':'BLOCKED_EXTERNAL_EVIDENCE_REQUIRED',
  project:'BLAISE_V6_RJ',reviewBasis:'PR173_PRIVATE_STAGING_NOV2026',
  reviewedSourceCount:allSources.length,sourceAudit:Object.freeze(allSources),
  sectorCount:RJ_SOURCE_SECTOR_MATRIX.length,
  policyFailures:Object.freeze(policyFailures),
  missingSectors:Object.freeze(missingSectors),
  unexpectedlyClaimedLive:Object.freeze(unexpectedLiveProducts),
  excludedSourcesActive:Object.freeze(activeExcluded),
  policyIntegrityPass:policyFailures.length===0,
  meteorologicalProductionHomologated:false,
  publishNewMeteorologicalSourcesToClients:false,
  allowNewAutomaticCollection:false,
  allowSafetyCriticalAlertsFromUnverifiedSources:false,
  noProviderNetworkCalls:true,noCreditReservations:true,
  noPaidPlans:true,noDeployment:true,
  requiredExternalGates:Object.freeze([
   'PRODUCTION_CONFIG_AND_LIVE_BACKEND_PREFLIGHT',
   'PROVIDER_PRODUCT_BY_PRODUCT_LIVE_FRESHNESS_AND_RJ_COVERAGE',
   'OBSERVED_RAIN_AND_RIVER_STATION_ORIGIN_OR_UNAVAILABLE',
   'PROVIDER_LICENCE_ATTRIBUTION_REPRODUCTION_RIGHTS',
   'SECRET_ROTATION_AND_LEAST_PRIVILEGE_AUDIT',
   'P0_SAFETY_REAL_ALERT_DELIVERY_AND_FALSE_POSITIVE_TEST',
   'ANDROID_DEVICE_UI_ENTITLEMENT_AND_ADMIN_ROLE_TEST',
   'PERFORMANCE_CANARY_ROLLBACK_OBSERVABILITY',
   'SEPARATE_HUMAN_PRODUCTION_RELEASE_AUTHORIZATION'
  ])
 });
}
