# CHM structured tide-value normalization

This layer is intentionally separate from live CHM PDF extraction. It closes the internal validation and canonicalization contract for official tide predictions **after** a future extractor has independently evidenced the source PDF/header/value format.

## Implemented contract

`backend/src/chm-tide-values.mjs` accepts only structured tide predictions explicitly attributed to one already validated RJ CHM tide station. It fail-closes on malformed station metadata, source page drift, year mismatch, impossible dates/times, duplicate local timestamps, excessive daily event counts, implausible heights, malformed source-artifact SHA-256 digests and missing/unproven time-basis metadata.

The caller must provide `timeBasis=LEGAL_LOCAL_TIME_FROM_CHM_TABLE_HEADER` and an explicit UTC offset read from the official station table header. The normalizer does not guess the station time zone, daylight-saving behavior or phase. Source phase tokens `PM`/`BM` may be normalized to `HIGH`/`LOW`; an absent phase remains null with `NOT_PROVIDED_NO_INFERENCE`.

Each prediction is bound to a source page inside the station's validated three-page range. The normalized result is sorted deterministically, emits UTC instants from the explicit table-header offset, retains no raw source text and produces a SHA-256 digest over the canonical station/year/time-basis/source-artifact/value set.

## Explicit boundary

This change does **not** claim live tide-value ingestion. The returned contract remains `STRUCTURED_OFFICIAL_CHM_TIDE_VALUES_NORMALIZER_LIVE_EXTRACTION_BLOCKED` and the normalized object records `liveSourceExtraction=BLOCKED_OFFICIAL_PDF_VALUE_EXTRACTION_NOT_EVIDENCED`.

The current live CHM probe therefore remains source-discovery/catalog evidence only. A later stage must separately prove the official CHM station PDF retrieval/extraction format, bind the extracted artifact SHA-256 to the normalizer, and then run the same final SHA through Android CI and Runtime before live tide values can be marked implemented.

## Safety and retention

- no raw PDF/text is retained by this normalization layer;
- no municipality P0 is created from tide values;
- no high/low phase is inferred when the source does not provide it;
- no station is accepted outside the already validated official RJ station metadata;
- synthetic unit tests validate the code contract only and are never represented as live CHM evidence.
