/**
 * Single source of truth for Blaise V6 RJ Table 1/2 routing.
 * This module only declares eligibility/order; it does NOT connect an API.
 * The original Table 1 ten-phenomenon complementary OpenWeatherMap product
 * remains registered, but is not a fourth independent official station.
 */
export const RJ_TABLE1_THREE = Object.freeze([
  'ALERTA_RIO',
  'DEFESA_CIVIL_RJ_REGIONAL',
  'INMET_STATION',
]);
export const RJ_TABLE2_FIVE = Object.freeze([
  ...RJ_TABLE1_THREE,
  'INPE_CPTEC_FORECAST',
  'WINDY_MODELO',
]);
export const RJ_TABLE1_TEN_COMPLEMENT = 'OPENWEATHERMAP_API';
export const RJ_SPECIALIST_MARINE_SOURCES = Object.freeze([
  'MARINHA_CHM', 'NOAA', 'COPERNICUS_MARINE', 'EUMETSAT_SATELLITE',
]);
export const RJ_TABLES_VERSION = '2026-10-14.v1';
export const RJ_SOURCE_DEFINITION_NOTICE =
  'Source ordering is product- and location-specific. Five registered channels do not prove five live connected feeds.';
