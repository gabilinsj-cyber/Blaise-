import test from 'node:test';
import assert from 'node:assert/strict';
import {DWD_RJ_92_POINTS} from '../scripts/probe-dwd-icon-numeric-staging.mjs';
import {approvedDwdIcon92AdminRecords} from '../src/rj-dwd-icon-92-admin-bridge.mjs';
import {buildDwdIconV1Url} from '../src/rj-dwd-icon-v1-source.mjs';
import {DWD_WEIGHTS_LEGACY_CUTOFF_UTC} from '../src/rj-dwd-icon-regrid.mjs';
const day=Date.UTC(2026,10,18,12,30);
const build=(now=day,pinned=false)=>{
  const issued=new Date(Math.floor((now-4*3600_000)/(6*3600_000))*(6*3600_000));
  // A model value must already be valid when it was checked (not in the future).
  const forecastHours=Math.floor((now-issued.valueOf()-60_000)/3600_000);
  const valid=new Date(issued.valueOf()+forecastHours*3600_000);
  return {
    contract:'BLAISE_DWD_ICON_GLOBAL_RJ_92_STAGING_V1',
    status:'FULL',municipalityCount:92,
    verifiedMunicipalities:92,missingMunicipalities:0,
    missingMunicipalityCodes:[],
    sourceId:'DWD_ICON_GLOBAL',kind:'P',datasetId:'ICON_GLOBAL_2M',
    issuedAt:issued.toISOString(),validAt:valid.toISOString(),
    checkedAt:new Date(now-60_000).toISOString(),
    sourceUrl:buildDwdIconV1Url(issued.toISOString().slice(0,16),forecastHours),
    distribution:'DWD_V1_NATIVE_GRIB2',
    weightsMode:pinned?'PINNED_OFFICIAL_ARCHIVE':'LEGACY_PRE_SUNSET_STAGING_ONLY',
    postSunsetReady:pinned,
    gridResolutionDegrees:0.25,
    gridInterpolation:'DWD_OFFICIAL_CDO_PRECOMPUTED_WEIGHTS',
    gridWeightsUrl:'https://opendata.dwd.de/weather/lib/cdo/ICON_GLOBAL2WORLD_025_EASY.tar.bz2',
    officialObservation:false,officialAlert:false,
    municipalityPointsNotPhysicalStations:true,networkDownloadsPerForecastGrid:1,
    automaticCollection:false,productionChanged:false,publishedToAndroid:false,
    records:DWD_RJ_92_POINTS.map(p=>({
      ibge:p.ibge,latitude:p.lat,longitude:p.lon,
      valueC:25.5,unit:'°C',sourceId:'DWD_ICON_GLOBAL',kind:'P'
    }))
  };
};
test('new v1 ICON Global GRIB2 proof can validate 92 RJ forecasts before cutoff',()=>{
  const p=build();
  assert.ok(p.sourceUrl.includes('/weather/nwp/v1/m/icon/p/T_2M/r/'));
  const records=approvedDwdIcon92AdminRecords(p,{now:day,dwdRightsReviewed:true});
  assert.equal(records.length,92);
  assert.equal(records.every(x=>x.category==='P'),true);
});
test('a legacy weights URL is not sufficient after removal on 30 November',()=>{
  const later=DWD_WEIGHTS_LEGACY_CUTOFF_UTC+11*3600_000;
  assert.equal(approvedDwdIcon92AdminRecords(build(later,false),{
    now:later,dwdRightsReviewed:true
  }).length,0);
  const pinned=approvedDwdIcon92AdminRecords(build(later,true),{
    now:later,dwdRightsReviewed:true
  });
  assert.equal(pinned.length,92);
});
test('no legacy distribution feed is accepted after sunset even with claims',()=>{
  const later=DWD_WEIGHTS_LEGACY_CUTOFF_UTC+10*3600_000;
  const fake=build(later,true);
  fake.distribution='DWD_LEGACY_GRIB2_BZIP2';
  assert.equal(approvedDwdIcon92AdminRecords(fake,{
    now:later,dwdRightsReviewed:true
  }).length,0);
});
test('no NOAA, Climatempo, wrong DWD files or future data allowed',()=>{
  for(const sourceUrl of [
    'https://opendata.dwd.de/weather/nwp/v1/m/icon/p/T_2M/r/2026-11-18T06%3A00/s/PT006H00M.grib2.bz2',
    'https://opendata.dwd.de/weather/nwp/v1/m/icon/p/T_2M/r/2026-11-18T06%3A00/s/../../evil.grib2',
    'https://example.com/weather/nwp/v1/m/icon/p/T_2M/r/2026-11-18T06%3A00/s/PT006H00M.grib2',
  ]) {
    const sample=build();sample.sourceUrl=sourceUrl;
    assert.equal(approvedDwdIcon92AdminRecords(sample,{now:day,dwdRightsReviewed:true}).length,0);
  }
});
