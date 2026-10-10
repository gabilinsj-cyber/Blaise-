import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';

const RJ_CODES = new Set(RJ_MUNICIPALITIES.map(c => c.ibge));
const CALCULATED = 'CALCULO_EXPERIMENTAL_BLAISE';
const UNAVAILABLE = 'DADOS_INSUFICIENTES';
const validNumber = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const insufficient = reason => Object.freeze({
  state: UNAVAILABLE, reason, mayTriggerAlert: false, officialMeasurement: false,
});
const calculated = fields => Object.freeze({
  state: CALCULATED, mayTriggerAlert: false, officialMeasurement: false, ...fields,
});
function haversineKm(a, b) {
  const r = Math.PI / 180;
  const lat = (b.latitude - a.latitude) * r;
  const lon = (b.longitude - a.longitude) * r;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * r)
    * Math.cos(b.latitude * r) * Math.sin(lon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Weighted mean of COMPARABLE, vetted official observations only.
 * The caller must use measured values from a station-level verified parser.
 * Winds from model viewers, official warning LEVELS, spatially distant data,
 * other municipalities, different time windows/units and stale samples block.
 *
 * Weights must be explicitly justified by quality control (not invented here);
 * return stays EXPERIMENTAL even if every input is from official stations.
 */
export function weightedOfficialMean({
  observations, now = Date.now(), maxAgeMs = 7_200_000,
  maxSkewMs = 900_000, maxSeparationKm = 25,
} = {}) {
  if (!Number.isFinite(now) || !validNumber(maxAgeMs, 1, 86_400_000)
      || !validNumber(maxSkewMs, 0, 3_600_000)
      || !validNumber(maxSeparationKm, 0, 100)) {
    throw new TypeError('rj_calculator_invalid_limits');
  }
  if (!Array.isArray(observations) || observations.length < 2 || observations.length > 12) {
    return insufficient('AT_LEAST_TWO_COMPARABLE_OFFICIAL_OBSERVATIONS_REQUIRED');
  }
  const first = observations[0];
  if (!first || !RJ_CODES.has(String(first.ibge))) return insufficient('MUNICIPALITY_NOT_CONFIRMED');
  if (!first.variable || !first.unit || /alert|nivel|risk|categoria|scale/i.test(String(first.variable))) {
    return insufficient('INVALID_VARIABLE_OR_NON_NUMERIC_WARNING_LEVEL');
  }
  const acceptable = observations.every(o => o && o.origin === 'OFFICIAL_OBSERVATION'
    && !['WINDY','WINDY_MODELO','INPE_CPTEC_FORECAST','NOAA'].includes(o.sourceId)
    && o.kind !== 'MODEL_FORECAST' && o.productKind !== 'FORECAST_MODEL'
    && typeof o.sourceId === 'string' && o.sourceId.length > 0
    && typeof o.stationId === 'string' && o.stationId.length > 0
    && o.ibge === first.ibge && o.variable === first.variable && o.unit === first.unit
    && validNumber(o.value, -100, 500)
    && validNumber(o.weight, 0.01, 5)
    && Number.isFinite(Date.parse(o.observedAt))
    && now - Date.parse(o.observedAt) >= 0
    && now - Date.parse(o.observedAt) <= maxAgeMs
    && validNumber(o.latitude, -23.7, -20.4)
    && validNumber(o.longitude, -45.5, -40.4)
    && typeof o.sourceUrl === 'string' && o.sourceUrl.startsWith('https://'));
  if (!acceptable) return insufficient('NON_OFFICIAL_STALE_MISMATCHED_OR_INVALID_OBSERVATION');
  if (new Set(observations.map(o => `${o.sourceId}:${o.stationId}`)).size !== observations.length) {
    return insufficient('DUPLICATE_STATION');
  }
  const times = observations.map(o => Date.parse(o.observedAt));
  if (Math.max(...times) - Math.min(...times) > maxSkewMs) {
    return insufficient('OBSERVATION_TIMES_NOT_COMPARABLE');
  }
  if (observations.some(o => observations.some(p => haversineKm(o, p) > maxSeparationKm))) {
    return insufficient('STATIONS_TOO_FAR_APART');
  }
  const weightSum = observations.reduce((s, o) => s + o.weight, 0);
  const value = observations.reduce((s, o) => s + o.weight * o.value, 0) / weightSum;
  return calculated({
    formula: 'SUM(w_i*x_i)/SUM(w_i)',
    value: Math.round(value * 100) / 100,
    unit: first.unit,
    variable: first.variable,
    ibge: first.ibge,
    sourceCount: observations.length,
    sourceIds: Object.freeze([...new Set(observations.map(o => o.sourceId))]),
    observedAt: new Date(Math.max(...times)).toISOString(),
    caution: 'ESTIMATIVA_LOCAL_NAO_MEDICAO_MUNICIPAL_NEM_ALERTA_OFICIAL',
  });
}

/** Magnus dew-point approximation; requires a same-time validated T/RH pair. */
export function dewPointCelsius({ temperatureC, humidityPercent, ibge, observedAt, now = Date.now() } = {}) {
  if (!RJ_CODES.has(String(ibge))) return insufficient('MUNICIPALITY_NOT_CONFIRMED');
  if (!validNumber(temperatureC, -30, 60) || !validNumber(humidityPercent, 1, 100)) {
    return insufficient('VALID_TEMPERATURE_AND_RELATIVE_HUMIDITY_REQUIRED');
  }
  const ms = Date.parse(observedAt);
  if (!Number.isFinite(ms) || !Number.isFinite(now) || now - ms < 0 || now - ms > 7_200_000) {
    return insufficient('EXPIRED_OR_FUTURE_OBSERVATION');
  }
  const a = 17.625, b = 243.04;
  const gamma = Math.log(humidityPercent / 100) + (a * temperatureC) / (b + temperatureC);
  return calculated({
    formula: 'MAGNUS_17_625_243_04',
    value: Math.round((b * gamma / (a - gamma)) * 10) / 10,
    unit: '°C', variable: 'PONTO_ORVALHO', ibge, observedAt,
    caution: 'DERIVADO_DE_MEDICOES_LOCAIS_VALIDAS_NAO_MEDICAO_DIRETA',
  });
}

/**
 * Heat index follows Rothfusz/NOAA only in its applicability domain;
 * wind chill is computed for cold conditions with sufficient wind.
 * Intermediate temperatures deliberately return unavailable instead of
 * inventing a "feels like" value.
 */
export function thermalSensationCelsius({
  temperatureC, humidityPercent, windKmh, ibge, observedAt,
  now = Date.now(),
} = {}) {
  if (!RJ_CODES.has(String(ibge))) return insufficient('MUNICIPALITY_NOT_CONFIRMED');
  const t = Date.parse(observedAt);
  if (!Number.isFinite(t) || !Number.isFinite(now) || now - t < 0 || now - t > 7_200_000) {
    return insufficient('EXPIRED_OR_FUTURE_OBSERVATION');
  }
  if (!validNumber(temperatureC, -30, 60)) return insufficient('TEMPERATURE_INVALID');
  if (temperatureC <= 10 && validNumber(windKmh, 4.8, 250)) {
    const chill = 13.12 + 0.6215 * temperatureC
      - 11.37 * windKmh ** 0.16 + 0.3965 * temperatureC * windKmh ** 0.16;
    return calculated({ variable: 'SENSACAO_TERMICA', unit: '°C',
      value: Math.round(chill * 10) / 10, formula: 'WIND_CHILL_STANDARD',
      ibge, observedAt, caution: 'ESTIMATIVA_DERIVADA_NAO_MEDICAO_DIRETA',
    });
  }
  if (temperatureC >= 27 && validNumber(humidityPercent, 40, 100)) {
    const f = temperatureC * 1.8 + 32, rh = humidityPercent;
    let hi = -42.379 + 2.04901523 * f + 10.14333127 * rh
      - 0.22475541 * f * rh - 0.00683783 * f ** 2
      - 0.05481717 * rh ** 2 + 0.00122874 * f ** 2 * rh
      + 0.00085282 * f * rh ** 2 - 0.00000199 * f ** 2 * rh ** 2;
    if (rh < 13 && f >= 80 && f <= 112) {
      hi -= (13 - rh) / 4 * Math.sqrt((17 - Math.abs(f - 95)) / 17);
    } else if (rh > 85 && f >= 80 && f <= 87) {
      hi += (rh - 85) / 10 * ((87 - f) / 5);
    }
    const c = (hi - 32) / 1.8;
    if (!Number.isFinite(c) || c < -30 || c > 80) return insufficient('HEAT_INDEX_OUT_OF_RANGE');
    return calculated({ variable: 'SENSACAO_TERMICA', unit: '°C',
      value: Math.round(c * 10) / 10, formula: 'ROTHFUSZ_HEAT_INDEX',
      ibge, observedAt, caution: 'ESTIMATIVA_DERIVADA_NAO_MEDICAO_DIRETA',
    });
  }
  return insufficient('THERMAL_SENSATION_FORMULA_NOT_APPLICABLE');
}
