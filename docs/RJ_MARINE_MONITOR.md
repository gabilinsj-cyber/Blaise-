# RJ Marine monitor — isolated adapter integration scaffold

This opt-in monitor accepts independently implemented `noaaReader` and `copernicusReader` functions returning normalized, provenance-checked samples. It does not store credentials or make any external request by itself. It is disabled by default and not wired into the production HTTP runtime.

- A bounded scheduler checks health every 60 seconds (fixed-start cadence, no overlapping runs).
- The default upstream refresh interval is 60 minutes, adjustable only after confirming the actual product cadence and terms.
- Each sample passes `reviewRjMarineSample`; observations, forecasts, stale values and failures remain separate.
- A reader must use a confirmed dataset/product identifier, authorized license, proper units, real UTC observation/validity time and source-specific quality flags. Do not set `licenseVerified` or `redistributionAuthorized` true without documentary proof.
- Copernicus: use the official Copernicus Marine Toolbox, with credentials in Secret Manager, and query bounded RJ subsets. Reference: https://help.marine.copernicus.eu/en/articles/8684964-using-the-copernicus-marine-toolbox-in-operational-workflows
- NOAA: select a concrete official dataset and documented endpoint (e.g. NOAA CoastWatch ERDDAP) before writing its parser. Do not assume all NOAA datasets provide currents or wave observations.
- No automatic claim of 92-municipality coverage, no live badge, no Android or Cloud Run deployment.

Before promotion: implement both transport readers, tests with fixture and real sample, verify dataset licensing, authenticated secret handling, timestamps, retries and production worker telemetry, then run CI and physical Android verification.
