import test from 'node:test';
import assert from 'node:assert/strict';
import geo from '../src/rj-ibge-92-points.json' with {type:'json'};
import {modelGridToAdminTemperatureRecords} from '../src/noaa-gfs-admin-coverage-bridge.mjs';
import {buildInternalRjMeteorologyCoverage} from '../src/rj-meteorological-completeness-audit.mjs';
const time='2026-11-18T11:00:00.000Z',now=Date.parse(time)+60_000;
const proof=()=>({
  contract:'RJ_NOAA_GFS_ATMOS_92_STAGING_V1',state:'FULL',
  kind:'P',sourceId:'NOAA_GFS',datasetId:'GFS_0P25_TMP_2M',
  modelNotStation:true,officialObservation:false,publishedToAndroid:false,
  productionChanged:false,municipalityCount:92,
  verifiedMunicipalities:92,missingMunicipalities:0,
  sourceUrl:'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?file=gfs.t06z.pgrb2.0p25.f003&dir=%2Fgfs.20261118%2F06%2Fatmos&var_TMP=on&lev_2_m_above_ground=on&subregion=&leftlon=-46&rightlon=-40&toplat=-20&bottomlat=-24',
  issuedAt:'2026-11-18T06:00:00.000Z',
  validAt:'2026-11-18T09:00:00.000Z',checkedAt:time,
  records:geo.points.map(p=>({ibge:p.ibge,latitude:p.lat,longitude:p.lon,
    temperatureC:21,unit:'°C',kind:'P',datasetId:'GFS_0P25_TMP_2M'}))
});
test('historical NOAA 92-city proof cannot enter active thermal audit after exclusion',()=>{
  const batch=proof();
  assert.equal(modelGridToAdminTemperatureRecords(batch,{now}).length,0);
  const records=modelGridToAdminTemperatureRecords(batch,{now,modelRightsReviewed:true});
  assert.equal(records.length,92);
  const report=buildInternalRjMeteorologyCoverage(records,{now});
  const temp=report.fields.find(x=>x.field==='temperatureC');
  assert.equal(temp.coveredMunicipalities,0);
  assert.equal(temp.state,'UNAVAILABLE');
  assert.equal(report.rejectedRecordCount,92);
  assert.equal(report.publishedToSubscriber,false);
  assert.ok(records.every(r=>r.category==='P'&&r.verifiedByBackend));
});
test('no untrusted point, outdated source or fake station observation may enter audit',()=>{
  const p=proof();p.records[0].latitude=10;
  assert.equal(modelGridToAdminTemperatureRecords(p,{now,modelRightsReviewed:true}).length,0);
  const q=proof();q.records[1].ibge=q.records[0].ibge;
  assert.equal(modelGridToAdminTemperatureRecords(q,{now,modelRightsReviewed:true}).length,0);
  const r=proof();r.officialObservation=true;
  assert.equal(modelGridToAdminTemperatureRecords(r,{now,modelRightsReviewed:true}).length,0);
  const s=proof();s.sourceUrl='https://example.com/';
  assert.equal(modelGridToAdminTemperatureRecords(s,{now,modelRightsReviewed:true}).length,0);
  const stale=proof();
  assert.equal(modelGridToAdminTemperatureRecords(stale,{now:now+60*60_000,modelRightsReviewed:true}).length,0);
});
