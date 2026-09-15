#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { evaluateWeatherTransitionBacktest } from '../src/rj-weather-transition-calibration.mjs';

const args = process.argv.slice(2);
const requireProductionPass = args.includes('--require-production-pass');
const positional = args.filter((arg) => arg !== '--require-production-pass');

if (positional.length < 1 || positional.length > 2) {
  console.error('usage: node scripts/backtest-rj-weather-transition.mjs <dataset.json> [output.json] [--require-production-pass]');
  process.exit(64);
}

const inputPath = resolve(positional[0]);
const outputPath = positional[1] ? resolve(positional[1]) : null;
const raw = readFileSync(inputPath);
const digest = createHash('sha256').update(raw).digest('hex');
const parsed = JSON.parse(raw.toString('utf8'));

if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
  throw new TypeError('dataset_root_object_required');
}
if (!Array.isArray(parsed.samples)) throw new TypeError('dataset_samples_array_required');

const suppliedEvidence = parsed.datasetEvidence && typeof parsed.datasetEvidence === 'object'
  ? parsed.datasetEvidence
  : {};
const datasetEvidence = {
  ...suppliedEvidence,
  datasetSha256: digest,
};

const result = evaluateWeatherTransitionBacktest(parsed.samples, { datasetEvidence });
const report = {
  generatedAt: new Date().toISOString(),
  inputFile: inputPath,
  inputSha256: digest,
  ...result,
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;

if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serialized, { encoding: 'utf8', mode: 0o600 });
} else {
  process.stdout.write(serialized);
}

console.error(`WEATHER_TRANSITION_BACKTEST_STATUS=${result.calibrationStatus}`);
console.error(`WEATHER_TRANSITION_PRODUCTION_CONFIDENCE_ALLOWED=${result.productionConfidenceLabelAllowed ? 'true' : 'false'}`);

if (requireProductionPass && !result.productionConfidenceLabelAllowed) process.exit(2);
