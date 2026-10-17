#!/usr/bin/env node
// Explicit manual probe: BLAISE_RJ_MARINE_LIVE_PROBE=true node scripts/rj_marine_live_probe.mjs
// Outputs sanitized metadata only; no tokens, response bodies, or raw URLs.
import { createNoaaMurSstReader } from '../src/rj-noaa-mur-reader.mjs';
import { reviewRjMarineSample } from '../src/rj-marine-freshness-gate.mjs';

if (process.env.BLAISE_RJ_MARINE_LIVE_PROBE !== 'true') {
  console.error('live_probe_opt_in_required');
  process.exitCode = 2;
} else {
  const reader = createNoaaMurSstReader({
    licenseVerified: process.env.BLAISE_NOAA_LICENSE_VERIFIED === 'true',
    redistributionAuthorized: process.env.BLAISE_NOAA_REDISTRIBUTION_AUTHORIZED === 'true',
  });
  try {
    const sample = await reader();
    const review = reviewRjMarineSample(sample);
    const evidence = {
      source: sample.sourceId,
      product: sample.productId,
      variable: sample.variable,
      unit: sample.unit,
      validTimeUtc: sample.validTimeUtc,
      checkedAtUtc: new Date().toISOString(),
      status: review.status,
      productionLiveVerified: false,
    };
    console.log(JSON.stringify(evidence));
    if (review.status !== 'CURRENT_OBSERVATION') process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({source:'NOAA', status:'FAILED', errorCode:
      ['noaa_license_not_verified','noaa_http_error','noaa_response_too_large','noaa_csv_schema_invalid','noaa_sample_invalid','noaa_units_unverified'].includes(error?.message) ? error.message : 'upstream_probe_failed'}));
    process.exitCode = 1;
  }
}
