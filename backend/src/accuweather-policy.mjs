import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';

// Eligibility only. No key, subscription, live coverage or observation is implied.
export const ACCUWEATHER_RJ_POLICY = Object.freeze({
  sourceId: 'ACCUWEATHER_API',
  role: 'COMPLEMENTARY_FORECAST_NOT_OFFICIAL_WARNING',
  municipalityIbges: Object.freeze(RJ_MUNICIPALITIES.map(city => city.ibge)),
  temperatureUnit: 'C', precipitationUnit: 'mm',
  minuteCastHorizonMinutes: 120,
  minuteCastProduct: 'PRECIPITATION_FORECAST_NOT_MEASUREMENT',
  ingestion: 'NOT_CONNECTED',
  requires: Object.freeze(['SERVER_API_KEY', 'PRODUCT_TERMS', 'PLAN', 'LOCAL_COVERAGE', 'VALID_TIME']),
  automaticAlertAuthority: false,
  consultationPolicy: 'ON_DEMAND_LAST_RESORT_AFTER_COMPATIBLE_PRIMARY_AND_TABLE2_SOURCES',
  dailyRequestLimit: 0, // Disabled until an explicit quota and API plan are configured.
  blendForecastWithObservedMeasurements: false,
});

// Missing quantities stay missing. An intensity category/dBZ is not an amount.
export function normalizeAccuWeatherQuantity(quantity, variable) {
  if (quantity == null || quantity.Value == null) return null;
  if (!Number.isFinite(quantity.Value)) throw new TypeError('accuweather_invalid_quantity');
  const value = quantity.Value, unit = quantity.Unit;
  if (variable === 'temperature') {
    if (unit === 'C') return value;
    if (unit === 'F') return (value - 32) * 5 / 9;
  } else if (variable === 'precipitation') {
    if (value < 0) throw new TypeError('accuweather_negative_precipitation');
    if (unit === 'mm') return value;
    if (unit === 'in') return value * 25.4;
  }
  throw new TypeError('accuweather_incompatible_unit');
}
