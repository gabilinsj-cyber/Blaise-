import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RJ_GEO_STATIONS_QUERY_URL, RJ_GEO_STATIONS_LICENSE,
  prepareRjGeoRioStationLocations,retrieveRjGeoRioStationLocations
} from '../src/rj-geo-rio-station-locations.mjs';
import {prepareRjLicensedTemperatureFusion}
  from '../src/rj-licensed-weighted-fusion.mjs';

const NOW=Date.parse('2026-11-13T18:00:00Z');
const geoFeature=(cod,est,lon=-43.23,lat=-22.91)=>({
  type:'Feature',properties:{cod,est},
  geometry:{type:'Point',coordinates:[lon,lat]}
});
const sample=(sourceId,productId,value,longitude)=>({
  kind:'OBSERVED_STATION_TEMPERATURE',metric:'TEMPERATURE_C',
  unit:'°C',sourceId,productId,value,longitude,latitude:-22.91,
  elevationM:40,quality:0.9,stationId:sourceId+'-station',
  observedAt:'2026-11-13T17:59:00Z',
  sourceUrl:sourceId==='inmet'
    ?'https://apitempo.inmet.gov.br/estacao/fixture'
    :'https://alertario.rio.rj.gov.br/estacao/fixture'
});
const grant=(sourceId,productId)=>({
  sourceId,productId,status:'VERIFIED',
  permission:'COMMERCIAL_PUBLIC_DISPLAY_AND_DERIVATION',
  evidenceId:'operator-review-20261113-'+sourceId,
  attribution:'Direitos deste produto conferidos pela administração Blaise',
  licenseUrl:sourceId==='inmet'
    ?'https://apitempo.inmet.gov.br/termos'
    :'https://alertario.rio.rj.gov.br/termos',
  validUntil:'2026-12-13T18:00:00Z'
});
const target={latitude:-22.91,longitude:-43.22,elevationM:35};
const a=sample('alerta-rio','ar-temperature',25,-43.23);
const b=sample('inmet','inmet-temp',26,-43.21);
const rights=[grant('alerta-rio','ar-temperature'),grant('inmet','inmet-temp')];

test('official municipal geospatial layer is CC BY 4.0 location ONLY',()=>{
  assert.match(RJ_GEO_STATIONS_QUERY_URL,/pgeo3\.rio\.rj\.gov\.br/);
  assert.match(RJ_GEO_STATIONS_QUERY_URL,/outSR=4326/);
  assert.equal(RJ_GEO_STATIONS_LICENSE,'https://creativecommons.org/licenses/by/4.0/');
  const result=prepareRjGeoRioStationLocations({
    type:'FeatureCollection',features:[geoFeature(1,'Tijuca'),geoFeature(2,'Guaratiba')]
  },{checkedAt:NOW});
  assert.equal(result.status,'GEOLOCATIONS_VERIFIED');
  assert.equal(result.stations.length,2);
  assert.equal(result.isLiveWeather,false);
  assert.equal(result.alertsVerified,false);
  assert.equal(result.stations[0].weatherObservation,null);
  assert.match(result.attribution,/Geo-Rio/);
  assert.equal(result.completeness,'PARTIAL_OFFICIAL_GEOSERVICE');
});
test('geographical duplicates, wrong projection, unknown geometry fail closed',()=>{
  const data={type:'FeatureCollection',features:[geoFeature(1,'Tijuca'),geoFeature(1,'Tijuca')]};
  assert.equal(prepareRjGeoRioStationLocations(data,{checkedAt:NOW}).status,'UNAVAILABLE');
  assert.equal(prepareRjGeoRioStationLocations({
    type:'FeatureCollection',features:[geoFeature(1,'UTM',650000,7450000)]
  },{checkedAt:NOW}).status,'UNAVAILABLE');
});
test('geographic data download is disabled by default and fetch is explicitly passed',async()=>{
  let calls=0;
  const off=await retrieveRjGeoRioStationLocations({
    fetchImpl:async()=>{calls++;throw Error('not called');}
  });
  assert.equal(off.status,'UNAVAILABLE');assert.equal(calls,0);
  const on=await retrieveRjGeoRioStationLocations({enabled:true,now:()=>NOW,
    fetchImpl:async(_url,opts)=>{
      calls++;assert.equal(opts.redirect,'error');
      return {status:200,headers:{get:()=>null},text:async()=>JSON.stringify({
        type:'FeatureCollection',features:[geoFeature(1,'São Cristóvão')]
      })};
    }
  });
  assert.equal(calls,1);assert.equal(on.status,'GEOLOCATIONS_VERIFIED');
});
test('no commercial verification, no secret laundering of restricted readings',()=>{
  const result=prepareRjLicensedTemperatureFusion({
    samples:[a,b],grants:[],target,now:NOW
  });
  assert.equal(result.status,'UNAVAILABLE');
  assert.equal(result.reason,'COMMERCIAL_RIGHTS_NOT_VERIFIED_FOR_EACH_PRODUCT');
  assert.equal(result.value,null);
});
test('independent licensed nearby observations create estimation with provenance',()=>{
  const r=prepareRjLicensedTemperatureFusion({
    samples:[a,b],grants:rights,target,now:NOW
  });
  assert.equal(r.status,'AUTHORIZED_WEIGHTED_ESTIMATE');
  assert.ok(r.value>25&&r.value<26);
  assert.equal(r.unit,'°C');
  assert.equal(r.sourceCount,2);
  assert.deepEqual(r.sources.map(x=>x.sourceId),['alerta-rio','inmet']);
  assert.equal(r.provenanceMustBeDisplayed,true);
  assert.equal(r.officialAlert,false);
  assert.equal(r.warningPublisherAuthorized,false);
  assert.equal(r.notRainfallInterpolation,true);
});
test('forecast, precipitation, banned source, duplicate provider, stale data and disagreements blocked',()=>{
  const attempts=[
    [a,{...b,kind:'MODEL_FORECAST'}],
    [a,{...b,metric:'RAIN_MM_1H'}],
    [a,{...b,sourceId:'windy'}],
    [a,{...b,sourceId:'alerta-rio'}],
    [a,{...b,observedAt:'2026-11-12T17:59:00Z'}],
    [a,{...b,value:36}],
    [a,{...b,longitude:-41.5}],
  ];
  for(const samples of attempts) {
    const result=prepareRjLicensedTemperatureFusion({samples,grants:rights,target,now:NOW});
    assert.equal(result.status,'UNAVAILABLE',JSON.stringify(samples));
    assert.equal(result.value,null);
  }
});
