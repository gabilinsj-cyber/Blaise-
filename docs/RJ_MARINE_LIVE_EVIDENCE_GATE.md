# RJ marine live evidence gate (NOAA / Copernicus)

This is a **manual validation runbook**, not evidence that a live probe already succeeded.

## Preconditions
1. CI backend and verify jobs green for the same commit SHA.
2. Confirm exact product/dataset IDs, accessible official endpoints, source attribution, terms of use and redistribution permissions. Keep both authorization flags false until documented.
3. Rotate any previously shared Copernicus password. Configure secrets through Google Secret Manager with the minimum Cloud Run service-account permissions. Never commit, paste, log or embed secrets in Android.
4. Install and pin the Copernicus Marine Toolbox in the backend image; verify actual dataset and variable names against the catalog before using the Python reader.

## Validation
- From a controlled backend environment, request only a small bounded RJ/Atlantic subset.
- For NOAA, verify ERDDAP CSV header, units row, latest time, numerical SST value, coordinate ordering, source URL and response status.
- For Copernicus, verify authentication, product ID, wave variable, returned dimensions, time coordinate, units and whether each value is analysis or forecast.
- Check timestamps against UTC and actual product publishing cadence. A health check every 60 seconds is not a new measurement every 60 seconds.
- Store only sanitized operational evidence: commit SHA, product ID, query time, valid time, status, freshness and quality checks, dataset license reference, and SHA-256 of normalized response. Never store raw credentials or token-bearing URLs.
- On HTTP errors, unexpected schema, absent licensing evidence or stale data, remain fail-closed and do not show LIVE in the app.
- Enable the monitor only after integration with the backend lifecycle, source provenance tests, secret injection and repeatable live probes. Validate the Android interface separately on a physical device.

## Current state
The PR includes an opt-in composition module and transport prototypes. It does not prove a production Cloud Run deployment, real authenticated ingestion, or physical Android operation. No manual gate is waived by a green unit-test run.
