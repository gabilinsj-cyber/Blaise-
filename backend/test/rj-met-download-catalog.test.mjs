import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RJ_MET_NORWAY_DOWNLOAD_CATALOG as catalog,
  getRjMetNorwayDownloadCandidates
} from '../src/rj-met-download-catalog.mjs';

test('MET download catalogue is research-only with no automatic source calls or public claims', () => {
  assert.equal(catalog.length,12);
  assert.equal(new Set(catalog.map(x=>x.id)).size,catalog.length);
  for(const portal of catalog){
    assert.equal(portal.ingestionEnabled,false);
    assert.equal(portal.publishedToAndroid,false);
    assert.equal(portal.realMeasurementsValidated,false);
    assert.match(portal.url,/^https:\/\//);
  }
});

test('only global Locationforecast and EUMETSAT Atlantic SST are RJ product candidates', () => {
  const candidates=getRjMetNorwayDownloadCandidates();
  assert.deepEqual(candidates.map(x=>x.id),[
    'MET_LOCATIONFORECAST_2','EUMETSAT_OSI_SAF_OSI_207_C'
  ]);
  assert.equal(candidates[0].origin,'ECMWF_IFS');
  assert.ok(candidates[0].restrictions.includes('DO_NOT_DOUBLE_COUNT_ECMWF'));
  assert.equal(candidates[1].origin,'EUMETSAT_OSI_SAF');
  assert.equal(candidates[1].category,'E');
  assert.ok(candidates[1].restrictions.includes('QUALITY_FLAGS'));
  assert.ok(catalog.some(x=>x.rjRole==='EXCLUDED_DIRECT_COPERNICUS'));
  assert.ok(catalog.some(x=>x.id==='YR_PORTAL'&&x.restrictions.includes('NO_YR_BRAND_IN_BLAISE')));
});
