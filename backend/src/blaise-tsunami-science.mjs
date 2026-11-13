/**
 * Blaise V6 RJ — long-wave physics and conditional tsunami diagnostics.
 * Numerical support only. This module DOES NOT detect a tsunami, issue an
 * alert, forecast inundation, prove first arrival, or assign coastal risk.
 * All bathymetry, water-only path, coastal target and provenance gates are
 * enforced by conditionalMarineTravelTime in the existing marine kernel.
 */
import { conditionalMarineTravelTime } from './blaise-marine-kernels.mjs';

const G = 9.80665;
const VERSION = 'rj-long-wave-sensitivity-20261113-v1';
function finite(v, name, min = -Infinity, max = Infinity) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
    throw new RangeError('invalid_' + name);
  }
  return v;
}
function positive(v, name, max=Infinity) {
  finite(v,name,0,max);
  if (v <= 0) throw new RangeError('invalid_' + name);
  return v;
}

/**
 * c = sqrt(g h); accepted only when lambda/h >= 20 for the supplied period.
 * The chosen threshold is an explicit long-wave applicability gate, not an
 * estimate of operational tsunami occurrence or danger.
 */
export function shallowWaterLongWaveSpeed({ depthMeters, periodSeconds }) {
  positive(depthMeters, 'depth_m', 12000);
  positive(periodSeconds, 'period_seconds', 7200);
  const speed = Math.sqrt(G * depthMeters);
  const wavelengthMeters = speed * periodSeconds;
  const wavelengthDepthRatio = wavelengthMeters / depthMeters;
  if (wavelengthDepthRatio < 20) throw new RangeError('long_wave_assumption_not_satisfied');
  return {
    value: speed, unit: 'm/s', wavelengthMeters, wavelengthDepthRatio,
    method: 'shallow_water_celerity_sqrt_g_depth', methodVersion: VERSION,
    nature: 'CALCULO_BLAISE', officialAlert: false,
    tsunamiDetected: false, firstArrivalProven: false, coastalImpactConfirmed: false,
    limitation: 'Ideal nondispersive long-wave local speed for supplied depth. No current, refraction, shoaling, runup, inundation, uncertainty in source, or tsunami detection.'
  };
}

/**
 * Supplied water-only route, bathymetry quality metadata and depth-uncertainty
 * envelope REQUIRED. Three same-route integrations (minimum, central, maximum
 * depth) estimate sensitivity, NOT a statistical prediction interval.
 */
export function tsunamiConditionalPathSensitivity({
  points, bathymetry, destination, originTime, periodSeconds,
  maxSegmentMeters, pathValidation
}) {
  if (!Array.isArray(points) || points.length < 2 || points.length > 10000) {
    throw new TypeError('bounded_validated_water_path_required');
  }
  positive(periodSeconds,'period_seconds',7200);
  const maps = { central: [], minDepth: [], maxDepth: [] };
  for (const point of points) {
    if (!point || typeof point !== 'object') throw new TypeError('bathymetry_point_required');
    const d = positive(point.depthMeters,'depth_m',12000);
    const lo = positive(point.minDepthMeters,'minimum_depth_m',12000);
    const hi = positive(point.maxDepthMeters,'maximum_depth_m',12000);
    if (!(lo <= d && d <= hi)) throw new RangeError('depth_uncertainty_does_not_contain_central');
    for (const depth of [lo,d,hi]) shallowWaterLongWaveSpeed({depthMeters:depth,periodSeconds});
    for (const [key, depth] of [['central',d],['minDepth',lo],['maxDepth',hi]]) {
      maps[key].push({latitude:point.latitude,longitude:point.longitude,depthMeters:depth});
    }
  }
  const common = {
    bathymetry, destination, originTime, propagation:'LONG_WAVE_APPROXIMATION',
    periodSeconds,maxSegmentMeters,pathValidation
  };
  const central = conditionalMarineTravelTime({...common, points: maps.central});
  const slow = conditionalMarineTravelTime({...common,points: maps.minDepth});
  const fast = conditionalMarineTravelTime({...common,points: maps.maxDepth});
  if (fast.value > central.value || central.value > slow.value) {
    throw new RangeError('nonmonotonic_depth_sensitivity');
  }
  return {
    value:central.value, unit:'s',
    conditionalTravelSeconds:central.value,
    fasterDepthTravelSeconds:fast.value,
    shallowerDepthTravelSeconds:slow.value,
    conditionalFasterArrivalUtc:fast.arrivalTimeUtc,
    conditionalCentralArrivalUtc:central.arrivalTimeUtc,
    conditionalSlowerArrivalUtc:slow.arrivalTimeUtc,
    source:central.bathymetry, pathVersion:central.pathVersion,
    destination:central.destination, method:'conditional_supplied_path_long_wave_depth_envelope',
    methodVersion:VERSION, nature:'CALCULO_BLAISE', officialAlert:false,
    tsunamiDetected:false, firstArrivalProven:false,
    coastalImpactConfirmed:false, inundationMeters:null,
    coastalHeightMeters:null, arrivalProbability:null,
    uncertaintyMeaning:'DEPTH_SENSITIVITY_ONLY_NO_PROBABILITY',
    limitation:'Conditional estimates along ONE supplied validated water path, not a shortest-path or first-arrival solution. Bounds reflect only supplied depth ranges, not source time, path error, bathymetry grid error, dispersion, currents, inundation, or likelihood. Never use for public tsunami ETA or evacuation warning.'
  };
}
