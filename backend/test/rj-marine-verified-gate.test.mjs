import test from 'node:test';
import assert from 'node:assert/strict';
import { createRjMarineBackend } from '../src/rj-marine-backend-integration.mjs';
import { createNoaaMurSstReader } from '../src/rj-noaa-mur-reader.mjs';
import { reviewRjMarineSample } from '../src/rj-marine-freshness-gate.mjs';

test('RJ marine stays off without explicit activation', () => {
  const app = createRjMarineBackend({ env: {} });
  assert.equal(app.enabled, false);
  assert.equal(app.start(), false);
});
test('RJ marine refuses absent Copernicus transport', () => {
  assert.throws(() => createRjMarineBackend({env:{BLAISE_RJ_MARINE_ENABLED:'true'}}), /copernicus_reader_required/);
});
test('NOAA license guard stops network before request', async () => {
  let requests=0;
  const reader=createNoaaMurSstReader({fetchImpl:async()=>{requests++;throw Error('unexpected')}});
  await assert.rejects(reader(), /noaa_license_not_verified/);
  assert.equal(requests,0);
});
test('NOAA sample CSV fixture carries real timestamp, never fake freshness', async () => {
  const reader=createNoaaMurSstReader({licenseVerified:true,redistributionAuthorized:true,
    fetchImpl:async()=>({ok:true,text:async()=> 'time,latitude,longitude,analysed_sst\nUTC,degrees_north,degrees_east,degree_C\n2025-01-01T12:00:00Z,-22.9,-42.9,23.5\n'})});
  const sample=await reader();
  assert.equal(sample.value,23.5);
  assert.equal(reviewRjMarineSample(sample,{nowMs:Date.parse('2026-10-17T12:00:00Z')}).status,'STALE');
});
