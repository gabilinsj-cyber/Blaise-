import test from 'node:test';
import assert from 'node:assert/strict';
import {DWD_RJ_92_POINTS} from '../scripts/probe-dwd-icon-numeric-staging.mjs';
import {approvedDwdIcon92AdminRecords} from '../src/rj-dwd-icon-92-admin-bridge.mjs';
import {buildInternalRjMeteorologyCoverage} from '../src/rj-meteorological-completeness-audit.mjs';
import {selectRjApprovedThermal} from '../src/rj-thermal-approved-policy.mjs';
const now=Date.parse('2026-11-18T11:46:00.000Z');
const forecast=()=>({
  contract:'BLAISE_DWD_ICON_GLOBAL_RJ_92_STAGING_V1',
  status:'FULL',municipalityCount:92,
  verifiedMunicipalities:92,missingMunicipalities:0,
  missingMunicipalityCodes:[],
  sourceId:'DWD_ICON_GLOBAL',kind:'P',datasetId:'ICON_GLOBAL_2M',
  issuedAt:'2026-11-18T06:00:00.000Z',
  validAt:'2026-11-18T11:00:00.000Z',
  checkedAt:'2026-11-18T11:45:00.000Z',
  sourceUrl:'https://opendata.dwd.de/weather/nwp/icon/grib/06/t_2m/icon_global_icosahedral_single-level_2026111806_005_T_2M.grib2.bz2',
  gridResolutionDegrees:0.25,
  gridInterpolation:'DWD_OFFICIAL_CDO_PRECOMPUTED_WEIGHTS',
  gridWeightsUrl:'https://opendata.dwd.de/weather/lib/cdo/ICON_GLOBAL2WORLD_025_EASY.tar.bz2',
  officialObservation:false,officialAlert:false,
  municipalityPointsNotPhysicalStations:true,
  networkDownloadsPerForecastGrid:1,
  automaticCollection:false,publishedToAndroid:false,productionChanged:false,
  records:DWD_RJ_92_POINTS.map(point=>({
    ibge:point.ibge,latitude:point.lat,longitude:point.lon,
    valueC:25.11,unit:'°C',sourceId:'DWD_ICON_GLOBAL',kind:'P'
  })),
});
test('German ICON registry has 92 verified unique Brazilian IBGE polygon points',()=>{
  assert.equal(DWD_RJ_92_POINTS.length,92);
  assert.equal(new Set(DWD_RJ_92_POINTS.map(x=>x.ibge)).size,92);
  assert.ok(DWD_RJ_92_POINTS.every(x=>x.lat>=-25&&x.lat<=-20));
  assert.ok(DWD_RJ_92_POINTS.some(x=>x.ibge==='3304557'));
});
test('92 validated model values pass private RJ completeness audit, not subscriber output',()=>{
  const records=approvedDwdIcon92AdminRecords(forecast(),{
    now,dwdRightsReviewed:true
  });
  assert.equal(records.length,92);
  assert.equal(records.filter(x=>x.category==='P').length,92);
  const audit=buildInternalRjMeteorologyCoverage(records,{now});
  const field=audit.fields.find(x=>x.field==='temperatureC');
  assert.equal(field.coveredMunicipalities,92);
  assert.equal(field.state,'FULL');
  assert.equal(audit.publishedToSubscriber,false);
  const rio=records.find(r=>r.ibge==='3304557');
  const thermal=selectRjApprovedThermal({
    municipalityIbge:'3304557',now,
    candidates:[{
      ...rio,nature:'P',officialObservation:false,officialAlert:false,
      licensedForCommercialUse:true,
      values:{temperatureC:rio.value}
    }]
  });
  assert.equal(thermal.temperatureC,25.11);
  assert.equal(thermal.feelsLikeC,null);
  assert.equal(thermal.publishedToSubscriber,false);
});
test('invalid, duplicate or old temperature record rejects entire proof',()=>{
  const cases=[
    batch=>{batch.records[0].latitude=0;},
    batch=>{batch.records[0].ibge=batch.records[1].ibge;},
    batch=>{batch.records[0].valueC=999;},
    batch=>{batch.records[0].sourceId='NOAA_GFS';},
    batch=>{batch.records[0].kind='O';},
    batch=>{batch.sourceUrl='https://example.org/synthetic.grib2';},
    batch=>{batch.officialObservation=true;},
    batch=>{batch.gridInterpolation='GUESS';},
    batch=>{batch.checkedAt='2026-11-18T10:00:00.000Z';},
    batch=>{batch.networkDownloadsPerForecastGrid=92;},
    batch=>{batch.missingMunicipalities=1;},
  ];
  for(const modify of cases){
    const sample=forecast();modify(sample);
    assert.equal(approvedDwdIcon92AdminRecords(sample,{
      now,dwdRightsReviewed:true
    }).length,0);
  }
});
test('partial official grid returns actual 91 records, one missing, not invented 92nd',()=>{
  const sample=forecast(),missing=sample.records.pop().ibge;
  sample.missingMunicipalityCodes=[missing];
  sample.missingMunicipalities=1;sample.verifiedMunicipalities=91;sample.status='PARTIAL';
  const values=approvedDwdIcon92AdminRecords(sample,{now,dwdRightsReviewed:true});
  assert.equal(values.length,91);
  assert.equal(values.some(x=>x.ibge===missing),false);
  assert.equal(approvedDwdIcon92AdminRecords(sample,{now}).length,0);
});
test('provider outage cannot be misinterpreted as an all-city reading',()=>{
  const sample={...forecast(),status:'UNAVAILABLE',records:[],
    verifiedMunicipalities:0,missingMunicipalities:92,
    missingMunicipalityCodes:DWD_RJ_92_POINTS.map(x=>x.ibge)};
  assert.equal(approvedDwdIcon92AdminRecords(sample,{
    now,dwdRightsReviewed:true
  }).length,0);
});
