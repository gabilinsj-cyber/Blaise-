import { createRjMarineMonitor } from './rj-marine-monitor.mjs';
import { createNoaaMurSstReader } from './rj-noaa-mur-reader.mjs';

// This opt-in composition does not start on import and never exposes credentials.
export function createRjMarineBackend({ env = process.env, fetchImpl = fetch, copernicusReader, now = () => Date.now() } = {}) {
  if (env.BLAISE_RJ_MARINE_ENABLED !== 'true') return Object.freeze({ enabled: false, start: () => false, stop: () => false, status: () => ({ enabled: false }) });
  if (typeof copernicusReader !== 'function') throw new TypeError('copernicus_reader_required');
  const noaaReader = createNoaaMurSstReader({
    fetchImpl,
    licenseVerified: env.BLAISE_NOAA_LICENSE_VERIFIED === 'true',
    redistributionAuthorized: env.BLAISE_NOAA_REDISTRIBUTION_AUTHORIZED === 'true',
  });
  const monitor = createRjMarineMonitor({ noaaReader, copernicusReader, now, enabled: true });
  return Object.freeze({ enabled: true, start: monitor.start, stop: monitor.stop, status: monitor.status });
}
