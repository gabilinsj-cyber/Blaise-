# South America Source Availability Gate

This gate verifies the public availability contracts used by the Blaise V6 RJ South America upstream weather layer without claiming that numerical forecast ingestion or WIS2 MQTT streaming is already live.

## Scope

The registry currently contains three WMO/WIS2 official upstream sources (Argentina SMN SYNOP, Uruguay INUMET SYNOP and Uruguay INUMET CAP) and two independent numerical guidance sources (ECMWF IFS Open Data and NOAA/NCEP GFS 0.25 degree). Local official Rio de Janeiro observations and alerts keep precedence. Upstream model guidance cannot override an official local observation/alert and cannot trigger P0.

The source availability probe checks:

- every WIS2 discovery URL is HTTPS and still exposes its registered WMO dataset identifier plus the expected WIS2 topic contract;
- ECMWF and NOAA public model availability pages are reachable over HTTPS and retain a source-specific contract marker;
- returned content is bounded before hashing;
- redirects stay on the expected HTTPS host;
- the registry still contains at least two independent model sources;
- every configured WIS2 broker uses `mqtts://` on port 8883 with the public `everyone/everyone` WIS2 credentials;
- the current NOAA global broker hostname is `wis2globalbroker.nws.noaa.gov`.

When model availability pages expose date tokens, the evidence records the newest discovered run-date token. This is availability evidence only; it does not prove a GRIB field was downloaded, decoded, geographically subset, or fed into the 24h/48h estimator.

## Workflow

`.github/workflows/south-america-source-probe.yml` is manual-only. Its `execute_live_probe` input defaults to `false`.

With the default value, the workflow uploads evidence explicitly marked `BLOCKED_EXTERNAL_EXECUTION_NOT_REQUESTED` / `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`. With explicit execution, it runs `backend/scripts/probe-south-america.mjs` under pinned Node 24.20.0 and uploads `evidence/south-america-sources/availability.json`.

The public probe requires no Google Cloud credentials, no service-account key and no WIF permission. CI self-tests prevent adding push, pull-request or scheduled execution to this gate and prevent cloud credentials from being introduced.

## Fail-closed boundaries

A PASS from this gate means only that all registered public discovery/availability contracts were reachable and matched their expected bounded markers at probe time. The evidence continues to report:

- `mqttLiveSubscription=NOT_IMPLEMENTED_NO_MQTT_CLIENT`
- `numericalForecastIngestion=NOT_IMPLEMENTED_AVAILABILITY_ONLY`
- `productionForecastIngestion=NOT_PROVEN`
- `canTriggerP0=false`

Production confidence for the 24h/48h transition estimator additionally requires the separate historical calibration gate and independently reviewed observed history. Synthetic tests and source-availability checks are not substitutes for that evidence.

## Next integration gate

After this availability foundation is green, the next implementation should add reviewed NOAA/ECMWF run adapters that download only the required fields/region with provenance and bounded resource use, produce canonical model-guidance records, and feed the estimator. WIS2 live subscription should be added separately with a deliberately audited MQTT dependency or an isolated ingestion service; it must not be introduced through an unreviewed dependency override.
