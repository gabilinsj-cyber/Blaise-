/**
 * Blaise V6 RJ — read-only, admin-only catalogue of MET Norway download portals.
 * Metadata is not a provider adapter: no fetch, no schedule, no public weather,
 * no claim of 92-county coverage and no license acceptance on behalf of humans.
 */
const entry=(id,name,url,category,rjRole,origin,restrictions=[])=>Object.freeze({
  id,name,url,category,rjRole,origin,
  ingestionEnabled:false,publishedToAndroid:false,realMeasurementsValidated:false,
  restrictions:Object.freeze(restrictions)
});
export const RJ_MET_NORWAY_DOWNLOAD_CATALOG=Object.freeze([
  entry('MET_LOCATIONFORECAST_2','MET Norway Locationforecast 2.0',
    'https://api.met.no/weatherapi/locationforecast/2.0/documentation',
    'P','GLOBAL_MODEL_CANDIDATE','ECMWF_IFS',
    ['HUMAN_TOS_ACCEPTANCE','BACKEND_ONLY','SHARED_CACHE_MIN_3H','DO_NOT_DOUBLE_COUNT_ECMWF']),
  entry('MET_FROST','Frost observations',
    'https://frost.met.no/','O','NORWEGIAN_STATION_ARCHIVE_NOT_RJ_SENSOR','MET_NORWAY',
    ['NO_VERIFIED_RJ_STATIONS','REGISTRATION_CLIENT_ID']),
  entry('MET_THREDDS','THREDDS archives',
    'https://thredds.met.no/','DATA_ARCHIVE','MODEL_DATA_REGIONAL_ONLY','MET_NORWAY',
    ['ECMWF_GLOBAL_NOT_FOR_DOWNLOAD_AT_THREDDS','PRODUCT_SPECIFIC_RIGHTS']),
  entry('MET_SEKLIMA','Seklima',
    'https://seklima.met.no/','CLIMATE_ARCHIVE','NORWEGIAN_OBSERVATION_PORTAL','MET_NORWAY',
    ['NO_VERIFIED_RJ_OBSERVATIONS']),
  entry('MET_ARCTIC_DATA_CENTRE','Arctic Data Centre',
    'https://adc.met.no/','POLAR_RESEARCH','OUT_OF_RJ_CORE_AREA','MET_NORWAY'),
  entry('EUMETSAT_OSI_SAF_OSI_207_C','OSI SAF GOES-East SST OSI-207-c',
    'https://osi-saf.eumetsat.int/products/sea-surface-temperature-products',
    'E','ATLANTIC_SST_PRODUCT_CANDIDATE','EUMETSAT_OSI_SAF',
    ['QUALITY_FLAGS','SOURCE_TIMESTAMPS','PROVENANCE_DEDUP','VERIFY_DISTRIBUTION_PATH','CC_BY_4_ATTRIBUTION']),
  entry('NORDATANET','Norwegian Scientific Data Network',
    'https://www.nersc.no/project/nordatanet','RESEARCH','NO_VERIFIED_RJ_DATASET','NORWEGIAN_RESEARCH'),
  entry('MET_CRYO','Cryo',
    'https://cryo.met.no/','POLAR_RESEARCH','OUT_OF_RJ_CORE_AREA','MET_NORWAY'),
  entry('SENTINEL_NATIONAL_GROUND_SEGMENT','National Ground Segment',
    'https://satellittdata.no/','SATELLITE_DISTRIBUTION','EXCLUDED_DIRECT_COPERNICUS','COPERNICUS_SENTINEL',
    ['DO_NOT_INGEST_DIRECT_COPERNICUS']),
  entry('YR_PORTAL','Yr forecast portal',
    'https://www.yr.no/','DISPLAY_PORTAL','NO_REPUBLICATION_OR_BRAND','MET_NORWAY_NRK',
    ['USE_MET_API_WITH_CREDITS','NO_YR_BRAND_IN_BLAISE']),
  entry('NORWEGIAN_CLIMATE_SERVICES','Norwegian Climate Service Centre',
    'https://klimaservicesenter.no/','CLIMATE_ARCHIVE','NO_VERIFIED_RJ_DATASET','NORWEGIAN_CLIMATE_SERVICES'),
  entry('SEKLIMA_OBSERVATIONS','Seklima Observations',
    'https://seklima.met.no/observations/','O','NORWEGIAN_STATION_ARCHIVE_NOT_RJ_SENSOR','MET_NORWAY',
    ['NO_VERIFIED_RJ_STATIONS'])
]);

// Unlike a generic service list, these two named PRODUCTS may have RJ coverage.
// Both require independent product-specific operational homologation.
export function getRjMetNorwayDownloadCandidates(){
  return Object.freeze(RJ_MET_NORWAY_DOWNLOAD_CATALOG.filter(x=>
    x.rjRole==='GLOBAL_MODEL_CANDIDATE'||x.rjRole==='ATLANTIC_SST_PRODUCT_CANDIDATE'));
}
