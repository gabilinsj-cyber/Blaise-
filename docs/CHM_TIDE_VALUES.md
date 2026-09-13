# CHM structured tide-value normalization

This layer is intentionally separate from live CHM PDF text/value extraction. It closes the internal validation and canonicalization contract for official tide predictions **after** an extractor has independently evidenced the source PDF/header/value format.

## Implemented contracts

`backend/src/chm-tide-values.mjs` accepts only structured tide predictions explicitly attributed to one already validated RJ CHM tide station. It fail-closes on malformed station metadata, source page drift, year mismatch, impossible dates/times, duplicate local timestamps, excessive daily event counts, implausible heights, malformed source-artifact SHA-256 digests and missing/unproven time-basis metadata.

`backend/src/chm-tide-artifact.mjs` now adds the preceding PDF-artifact boundary. For each station already bound by the official CHM RJ catalog, it can retrieve only the pinned HTTPS CHM PDF, enforce the binary `application/pdf` contract and a 2 MiB ceiling, validate `%PDF-` plus a bounded trailing `%%EOF` marker, and emit the source-artifact SHA-256 and byte length. The raw PDF bytes are not returned by the validator and are not retained by the evidence layer after validation.

The caller of the tide-value normalizer must still provide `timeBasis=LEGAL_LOCAL_TIME_FROM_CHM_TABLE_HEADER` and an explicit UTC offset read from the official station table header. The normalizer does not guess the station time zone, daylight-saving behavior or phase. Source phase tokens `PM`/`BM` may be normalized to `HIGH`/`LOW`; an absent phase remains null with `NOT_PROVIDED_NO_INFERENCE`.

Each prediction is bound to a source page inside the station's validated three-page range. The normalized result is sorted deterministically, emits UTC instants from the explicit table-header offset, retains no raw source text and produces a SHA-256 digest over the canonical station/year/time-basis/source-artifact/value set.

## Explicit boundary

PDF artifact/container validation is not tide-value extraction. The artifact validator contract is `OFFICIAL_CHM_TIDE_PDF_ARTIFACT_VALIDATED_NO_TEXT_EXTRACTION`; the structured value contract remains `STRUCTURED_OFFICIAL_CHM_TIDE_VALUES_NORMALIZER_LIVE_EXTRACTION_BLOCKED` until the official PDF text/table layout has been independently proven and parsed fail closed.

The manual CHM source workflow is the only current live path for exercising the artifact retrieval contract. Its default remains external execution not requested. A successful live artifact probe may prove host/path/content-type/container/digest evidence only; it must not be represented as proof that tide rows, time basis, UTC offset, phases or heights were extracted.

A later stage must separately validate the official CHM PDF text/table extraction format, bind each extracted value set to the exact PDF artifact SHA-256, and then run the same final SHA through Android CI and Runtime before live tide values can be marked implemented.

## Safety and retention

- no raw PDF bytes or extracted source text are retained by the tide artifact/value evidence layers;
- no municipality P0 is created from tide values;
- no high/low phase is inferred when the source does not provide it;
- no station is accepted outside the already validated official RJ station metadata;
- PDF network retrieval is HTTPS-only, CHM-host allowlisted, redirect-rejecting, content-type checked and size bounded;
- synthetic unit tests validate code contracts only and are never represented as live CHM evidence.
