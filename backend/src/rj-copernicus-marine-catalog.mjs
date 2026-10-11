/**
 * Copernicus Marine Service (CMEMS) — verified PUBLIC METADATA, not live data.
 * Marine Data Store: https://data.marine.copernicus.eu/products
 * EU open data can support commercial applications subject to current
 * Copernicus Marine Licence Agreement, appropriate credits and product DOI.
 *
 * All samples must be obtained by a separate authenticated/authorized
 * ingestion worker. Never copy third-party chart screenshots/tiles and
 * never interpret a model grid cell as an in-situ sensor or official warning.
 */
export const CMEMS_SOURCE = Object.freeze({
  sourceId:'COPERNICUS_MARINE',
  displayName:'Copernicus Marine Service (CMEMS — União Europeia)',
  institution:'E.U. Copernicus Marine Service / Mercator Ocean International',
  homeUrl:'https://marine.copernicus.eu/',
  catalogUrl:'https://data.marine.copernicus.eu/products',
  licenceUrl:'https://marine.copernicus.eu/user-corner/service-commitments-and-licence',
  acknowledgementHelpUrl:'https://help.marine.copernicus.eu/en/articles/4444611-citing-copernicus-marine-products-and-services',
  apiGuidanceUrl:'https://help.marine.copernicus.eu/en/articles/7949409-copernicus-marine-toolbox-introduction',
  commercialUse:'FREE_WITH_LICENCE_AND_ATTRIBUTION_SUBJECT_TO_PRODUCT_CONDITIONS',
  access:'FREE_REGISTRATION_MAY_BE_REQUIRED',
  runtimeStatus:'NOT_CONNECTED_TO_LIVE_CMEMS',
  mayIssueOfficialMarineAlert:false,
  mayIndependentlyVerifyTsunami:false,
  requiresPerProductLicenceVerification:true,
  notAPortTideTable:true,
});

/** Products with IDs and DOIs cross-checked against the official data store. */
export const CMEMS_MARINE_PRODUCTS = Object.freeze([
  Object.freeze({
    id:'GLOBAL_ANALYSISFORECAST_WAV_001_027',
    name:'Global Ocean Waves Analysis and Forecast',
    url:'https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_WAV_001_027/description',
    doi:'10.48670/moi-00017',
    kind:'NUMERICAL_OCEAN_WAVE_MODEL',
    variables:Object.freeze(['WAVE_HEIGHT_M','WAVE_PERIOD_S','WAVE_DIRECTION_DEG']),
    applicability:Object.freeze(['ONDAS','RESSACA','CICLONE_EXTRATROPICAL']),
    typicalGridDegrees:0.083,
    timeSupport:'MODEL_ANALYSIS_AND_FORECAST_3_HOURLY_FIELDS',
  }),
  Object.freeze({
    id:'GLOBAL_ANALYSISFORECAST_PHY_001_024',
    name:'Global Ocean Physics Analysis and Forecast',
    url:'https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_PHY_001_024/description',
    doi:'10.48670/moi-00016',
    kind:'NUMERICAL_OCEAN_PHYSICS_MODEL',
    variables:Object.freeze(['SEA_WATER_TEMPERATURE_C','OCEAN_CURRENT_U_MS','OCEAN_CURRENT_V_MS','SEA_SURFACE_HEIGHT_M']),
    applicability:Object.freeze(['TEMPERATURA_MAR','CORRENTES_MARINHAS','CICLONE_EXTRATROPICAL','MASSA_AR']),
    typicalGridDegrees:0.083,
    timeSupport:'MODEL_ANALYSIS_AND_FORECAST',
  }),
  Object.freeze({
    id:'SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001',
    name:'Global Ocean OSTIA Sea Surface Temperature and Sea Ice Analysis',
    url:'https://data.marine.copernicus.eu/product/SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001/description',
    doi:'10.48670/moi-00165',
    kind:'SATELLITE_AND_IN_SITU_BASED_GAP_FREE_ANALYSIS',
    variables:Object.freeze(['SEA_WATER_TEMPERATURE_C']),
    applicability:Object.freeze(['TEMPERATURA_MAR','MASSA_AR']),
    typicalGridDegrees:0.05,
    timeSupport:'DAILY_GAP_FREE_ANALYSIS_NOT_SINGLE_THERMOMETER',
  }),
]);
const byProduct=new Map(CMEMS_MARINE_PRODUCTS.map(p=>[p.id,p]));
export const CMEMS_RJ_MARITIME = Object.freeze({
  // Complementary Atlantic context around RJ. Not a coastal tide station.
  west:-46.0,east:-39.5,south:-25.0,north:-20.0,
  allowedRegions:Object.freeze(['LITORAL','ATLANTICO']),
});
const VALID_UNITS = Object.freeze({
  WAVE_HEIGHT_M:{unit:'m',min:0,max:35},
  WAVE_PERIOD_S:{unit:'s',min:0,max:40},
  WAVE_DIRECTION_DEG:{unit:'degrees',min:0,max:360},
  SEA_WATER_TEMPERATURE_C:{unit:'°C',min:-3,max:42},
  OCEAN_CURRENT_U_MS:{unit:'m/s',min:-8,max:8},
  OCEAN_CURRENT_V_MS:{unit:'m/s',min:-8,max:8},
  SEA_SURFACE_HEIGHT_M:{unit:'m',min:-30,max:30},
});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const invalid=reason=>Object.freeze({
  status:'UNAVAILABLE',reason,point:null,
  officialWarning:false,observationAtMunicipalStation:false,
});

export function cmemsProductsFor({phenomenon,region='ATLANTICO'}={}) {
  if(!CMEMS_RJ_MARITIME.allowedRegions.includes(region))
    throw TypeError('copernicus_marine_requires_rj_littoral_or_atlantic_region');
  if(typeof phenomenon!=='string'||!phenomenon)
    throw TypeError('copernicus_marine_phenomenon_required');
  return Object.freeze(CMEMS_MARINE_PRODUCTS.filter(p=>p.applicability.includes(phenomenon)));
}

/**
 * A validated, attributed product record for rendering on Blaise's OWN map.
 * Does not perform requests or claim a live source connection.
 *
 * The integration must explicitly attest that the applicable product licence
 * is accepted and that credits/DOIs are carried to the user-facing display.
 * For CMEMS gridded analysis, even SST tagged "observations" is not a single
 * point-of-measurement thermometer; samples retain their provenance kind.
 */
export function validateCmemsMarineSample({
  sample, now=Date.now(),maxAgeMs=86_400_000,
}={}) {
  if(!sample||typeof sample!=='object'||Array.isArray(sample)
    ||!finite(now)||!finite(maxAgeMs)||maxAgeMs<1||maxAgeMs>172_800_000)
    return invalid('INVALID_INPUT');
  const product=byProduct.get(sample.productId);
  if(!product)return invalid('UNKNOWN_CMEMS_PRODUCT');
  if(sample.sourceId!==CMEMS_SOURCE.sourceId)return invalid('SOURCE_ID_MISMATCH');
  if(sample.region!=='ATLANTICO'&&sample.region!=='LITORAL')
    return invalid('NOT_RJ_ADJACENT_MARINE_REGION');
  if(!product.variables.includes(sample.variable)||!VALID_UNITS[sample.variable])
    return invalid('VARIABLE_NOT_SUPPORTED_BY_PRODUCT');
  const range=VALID_UNITS[sample.variable];
  if(sample.unit!==range.unit ||!finite(sample.value)
    ||sample.value<range.min||sample.value>range.max)
    return invalid('INVALID_VARIABLE_UNIT_OR_VALUE');
  if(!finite(sample.latitude)||!finite(sample.longitude)
    ||sample.latitude<CMEMS_RJ_MARITIME.south
    ||sample.latitude>CMEMS_RJ_MARITIME.north
    ||sample.longitude<CMEMS_RJ_MARITIME.west
    ||sample.longitude>CMEMS_RJ_MARITIME.east)
    return invalid('OUTSIDE_RJ_MARINE_AREA');
  if(sample.licenseStatus!=='VERIFIED_FOR_BLAISE_COMMERCIAL_USE'
    ||sample.attributionStatus!=='COPERNICUS_AND_PRODUCT_DOI_VISIBLE')
    return invalid('LICENCE_OR_ATTRIBUTION_UNVERIFIED');
  if(sample.doi!==product.doi)return invalid('PRODUCT_DOI_MISMATCH');
  const at=Date.parse(sample.validAt),issued=Date.parse(sample.issuedAt);
  if(!finite(at)||!finite(issued)||issued>now||now-issued<0
    ||now-issued>maxAgeMs)
    return invalid('MISSING_OR_STALE_ISSUE_TIME');
  if(product.kind==='SATELLITE_AND_IN_SITU_BASED_GAP_FREE_ANALYSIS') {
    if(at>now ||now-at>maxAgeMs)return invalid('STALE_OR_FUTURE_OBSERVATIONAL_ANALYSIS');
    if(sample.kind!=='GRIDDED_SATELLITE_ANALYSIS')
      return invalid('WRONG_DATA_PRODUCT_KIND');
  }else{
    if(at<now-maxAgeMs||at>now+10*86_400_000)return invalid('FORECAST_TIME_INVALID');
    if(sample.kind!=='MODEL_ANALYSIS_OR_FORECAST')
      return invalid('WRONG_DATA_PRODUCT_KIND');
  }
  if(typeof sample.gridCellId!=='string'||sample.gridCellId.length<3
    ||typeof sample.datasetId!=='string'||sample.datasetId.length<3)
    return invalid('GRID_PROVENANCE_MISSING');
  return Object.freeze({
    status:'VALID_CMEMS_GRID_PRODUCT_SAMPLE',
    sourceId:CMEMS_SOURCE.sourceId,
    point:Object.freeze({
      latitude:sample.latitude,longitude:sample.longitude,
      variable:sample.variable,value:sample.value,unit:sample.unit,
      validAt:sample.validAt,issuedAt:sample.issuedAt,
      datasetId:sample.datasetId,gridCellId:sample.gridCellId,
      productId:product.id,productUrl:product.url,
      productKind:product.kind,doi:product.doi,
      attribution:'E.U. Copernicus Marine Service Information',
      displayKind:product.kind==='SATELLITE_AND_IN_SITU_BASED_GAP_FREE_ANALYSIS'
        ?'GRIDDED_OBSERVATIONAL_ANALYSIS_NOT_IN_SITU_STATION'
        :'GRIDDED_OCEAN_MODEL_NOT_OFFICIAL_WEATHER_WARNING',
    }),
    officialWarning:false,maySendAudioAlert:false,
    observationAtMunicipalStation:false,
    mayBeShownOnBlaiseOwnMap:true,
    interpretedAsTideTable:false,
    isProofOfRipCurrentOrSafeSea:false,
  });
}
