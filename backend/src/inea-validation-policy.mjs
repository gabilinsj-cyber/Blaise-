const INEA_NOT_CONFIGURED = 'NOT_RUN_STATION_URL_NOT_CONFIGURED';

export function evaluateIneaLiveValidation({
  discoveryAvailable,
  stationConfigured,
  stationOperationalPass,
}) {
  const configured = stationConfigured === true;
  const operational = configured && stationOperationalPass === true;

  return Object.freeze({
    status: operational ? 'PASS' : 'NOT_VALIDATED',
    discoveryStatus: discoveryAvailable === true ? 'PASS' : 'UNAVAILABLE',
    operationalStatus: !configured
      ? INEA_NOT_CONFIGURED
      : operational ? 'CURRENT' : 'UNAVAILABLE',
    shouldFailWorkflow: configured && !operational,
  });
}
