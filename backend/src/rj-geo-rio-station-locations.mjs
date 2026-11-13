/**
 * Geo-Rio / Alerta Rio station LOCATIONS only.
 * Official metadata for this point layer: CC BY 4.0, credit Fundação Geo-Rio/PCRJ.
 * This license applies to the geographic data, NOT to weather observations.
 * No scraping, stealth, telemetry concealment, third-party map tiles or radar.
 * Fetch is opt-in; this module never runs on import.
 */
export const RJ_GEO_STATIONS_LAYER =
  'https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Geotecnia/Estacoes_AlertaRio/FeatureServer/0';
export const RJ_GEO_STATIONS_METADATA = RJ_GEO_STATIONS_LAYER + '/metadata?f=html&format=default';
export const RJ_GEO_STATIONS_LICENSE = 'https://creativecommons.org/licenses/by/4.0/';
export const RJ_GEO_STATIONS_ATTRIBUTION =
  'Estações Alerta Rio — Fundação Geo-Rio / Prefeitura da Cidade do Rio de Janeiro; CC BY 4.0; posições convertidas para WGS84 por consulta ao serviço ArcGIS.';

const query = new URLSearchParams({
  where:'1=1',outFields:'cod,est',returnGeometry:'true',
  outSR:'4326',f:'geojson',orderByFields:'cod ASC'
});
export const RJ_GEO_STATIONS_QUERY_URL = RJ_GEO_STATIONS_LAYER + '/query?' + query;

const unavailable = reason => Object.freeze({
  status:'UNAVAILABLE',reason,stations:Object.freeze([]),
  measuredAt:null,isLiveWeather:false,alertsVerified:false
});
const inRange = (value,min,max) =>
  typeof value==='number' && Number.isFinite(value) && value>=min && value<=max;

/** Validate finite coordinates, 33-record upper bound and source provenance. */
export function prepareRjGeoRioStationLocations(geojson,{checkedAt=Date.now()}={}) {
  if(!Number.isSafeInteger(checkedAt)||checkedAt<0) return unavailable('INVALID_CHECK_CLOCK');
  if(!geojson||geojson.type!=='FeatureCollection'||!Array.isArray(geojson.features)||
      geojson.features.length<1||geojson.features.length>33)
    return unavailable('INVALID_GEO_STATION_DATA');
  const seen=new Set(),stations=[];
  for(const feature of geojson.features) {
    if(feature?.type!=='Feature'||feature.geometry?.type!=='Point'||
        !Array.isArray(feature.geometry.coordinates))return unavailable('INVALID_POINT');
    const [lon,lat]=feature.geometry.coordinates;
    const code=feature.properties?.cod, name=feature.properties?.est;
    if(!Number.isInteger(code)||code<1||code>33||seen.has(code)||
        typeof name!=='string'||name.trim().length<2||name.length>70||
        !inRange(lon,-43.75,-43.10)||!inRange(lat,-23.11,-22.74))
      return unavailable('INVALID_STATION_GEOMETRY_OR_ID');
    seen.add(code);
    stations.push(Object.freeze({stationCode:code,name:name.trim(),
      latitude:lat,longitude:lon,kind:'OFFICIAL_STATION_LOCATION_ONLY',
      weatherObservation:null,radarObservation:null,sourceLayer:RJ_GEO_STATIONS_LAYER}));
  }
  stations.sort((a,b)=>a.stationCode-b.stationCode);
  return Object.freeze({
    status:'GEOLOCATIONS_VERIFIED',stations:Object.freeze(stations),
    checkedAt:new Date(checkedAt).toISOString(),isLiveWeather:false,
    measuredAt:null,alertsVerified:false,expectedStationCount:33,
    completeness:stations.length===33?'EXPECTED_33_GEOPOSITIONS':'PARTIAL_OFFICIAL_GEOSERVICE',
    attribution:RJ_GEO_STATIONS_ATTRIBUTION,
    license:'CC BY 4.0',licenseUrl:RJ_GEO_STATIONS_LICENSE,
    metadataUrl:RJ_GEO_STATIONS_METADATA,sourceUrl:RJ_GEO_STATIONS_LAYER,
    mapRenderer:'BLAISE_NATIVE_SYMBOL_LAYER',thirdPartyMapCopied:false
  });
}

/** Explicitly authorized backend adapter; import alone performs no request. */
export async function retrieveRjGeoRioStationLocations({
  enabled=false,fetchImpl=null,now=Date.now
}={}) {
  if(!enabled||typeof fetchImpl!=='function')return unavailable('GEO_FETCH_NOT_CONFIGURED');
  try {
    const at=now();
    if(!Number.isSafeInteger(at)||at<0)return unavailable('INVALID_CHECK_CLOCK');
    const response=await fetchImpl(RJ_GEO_STATIONS_QUERY_URL,{
      method:'GET',headers:{Accept:'application/geo+json, application/json'},
      redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)
    });
    if(response?.status!==200)return unavailable('OFFICIAL_GEO_SOURCE_UNAVAILABLE');
    const length=Number(response.headers?.get?.('content-length'));
    if(Number.isFinite(length)&&length>250_000)return unavailable('GEOSERVICE_RESPONSE_TOO_LARGE');
    const body=await response.text();
    if(body.length>250_000)return unavailable('GEOSERVICE_RESPONSE_TOO_LARGE');
    return prepareRjGeoRioStationLocations(JSON.parse(body),{checkedAt:at});
  }catch{
    return unavailable('OFFICIAL_GEO_SOURCE_UNAVAILABLE');
  }
}
