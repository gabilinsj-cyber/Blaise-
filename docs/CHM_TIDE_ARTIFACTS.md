# CHM tide PDF artifact gate

This gate closes the binary-artifact boundary between the validated official RJ tide-station/PDF catalog and future tide-table text/value extraction.

## Contract

`backend/src/chm-tide-artifact.mjs` accepts only station descriptors already bound to the official CHM host and tide-data path. It fails closed before networking when the station number, name, three-page range, filename or URL binding is malformed.

Network retrieval uses the shared source contract: HTTPS only, CHM host allowlist, no credentials, no redirects, explicit `application/pdf`, a 12-second timeout and a 2 MiB body ceiling. The downloaded object must contain the `%PDF-` signature and a trailing `%%EOF` marker. A successful artifact result contains the station identity, official PDF filename, byte length and SHA-256 digest, but does not expose or persist the PDF bytes.

For the RJ catalog, all seven validated 2026 station PDFs must pass. The aggregate result produces `artifactInventorySha256` from deterministic per-station artifact metadata and reports `PASS_OFFICIAL_CHM_PDF_CONTAINER_AND_DIGEST`.

## Live evidence boundary

The implementation and synthetic unit tests are code-contract evidence only. Live CHM retrieval remains manual-only through `.github/workflows/chm-source-probe.yml`; the workflow defaults to `execute_live_probe=false` and records `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED` when external execution is not requested.

A live PASS at this stage proves only that the already bound official PDF URLs were retrievable under the bounded binary contract and that their container signatures/digests were captured. It does **not** prove PDF text extraction, table-header interpretation, UTC offset, tide-event rows, heights or high/low phases.

Those remain `NOT_IMPLEMENTED` until a separate fail-closed parser is evidenced against the official layout and each extracted set is cryptographically bound to its exact source PDF SHA-256.

## Retention and safety

- raw PDF bytes: `NONE_AFTER_VALIDATION`;
- extracted PDF text: not implemented and not retained;
- redirects: rejected;
- alternate hosts/paths: rejected;
- non-PDF content types: rejected;
- oversized/truncated/non-PDF containers: rejected;
- no P0 alert is derived from this artifact gate;
- no live external execution occurs on push or pull request.
