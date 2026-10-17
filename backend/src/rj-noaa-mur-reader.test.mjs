import test from 'node:test';
import assert from 'node:assert/strict';
import { createNoaaMurSstReader } from './rj-noaa-mur-reader.mjs';

test('NOAA reader fails closed without verified redistribution permission', async () => {
  let called = false;
  const reader = createNoaaMurSstReader({ fetchImpl: async () => { called = true; throw Error('network'); } });
  await assert.rejects(reader(), /noaa_license_not_verified/);
  assert.equal(called, false);
});
test('NOAA reader parses verified CSV fixture and preserves source time', async () => {
  const reader = createNoaaMurSstReader({
    licenseVerified: true, redistributionAuthorized: true,
    fetchImpl: async url => {
      assert.match(url, /^https:\/\/coastwatch\.pfeg\.noaa\.gov\/erddap\/griddap\/jplMURSST41\.csv\?/);
      return { ok: true, text: async () => 'time,latitude,longitude,analysed_sst\nUTC,degrees_north,degrees_east,degree_C\n2026-10-16T12:00:00Z,-22.9,-42.9,23.5\n' };
    },
  });
  const sample = await reader();
  assert.equal(sample.value, 23.5);
  assert.equal(sample.validTimeUtc, '2026-10-16T12:00:00.000Z');
  assert.equal(sample.sourceId, 'NOAA');
});
test('NOAA reader rejects wrong units', async () => {
  const reader = createNoaaMurSstReader({
    licenseVerified: true, redistributionAuthorized: true,
    fetchImpl: async () => ({ok:true,text:async()=> 'time,analysed_sst\nUTC,kelvin\n2026-10-16T12:00:00Z,296\n'}),
  });
  await assert.rejects(reader(), /noaa_units_unverified/);
});
