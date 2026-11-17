#!/usr/bin/env python3
"""Offline, one-file, 92-municipality scientific QA for JAXA GSMaP_NRT v9.

Input must be a REAL `gsmap_nrt.YYYYMMDD.HH00.dat.gz` copied from the JAXA
protected distribution by an authorized operator. No network or credentials.

Official JAXA NRT9 data-format specification (19 Oct 2026):
  https://sharaku.eorc.jaxa.jp/GSMaP/document/new/DataFormatDescription_NRT9.pdf
  3600 longitude x 1200 latitude, 0.1 degree, first-cell center
  0.05 E / 59.95 N, float32 little-endian, mm/hr; negatives = missing,
  nominal four-hour reporting latency.
Numeric retrieval alone never proves satellite QA flags, real observation,
legal permission to re-distribute or permission for Blaise alerts.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import re
import struct
from datetime import datetime, timezone
from pathlib import Path

COLS = 3600
ROWS = 1200
EXACT_BYTES = COLS * ROWS * 4
MAX_COMPRESSED_BYTES = 22 * 1024 * 1024
RE = re.compile(r"^gsmap_nrt\.(20\d{6})\.(\d{2})(00)\.dat\.gz$", re.I)
SOURCE = "JAXA_GSMAP_NRT_ALGORITHM_V9"
DATAFORMAT_URL = "https://sharaku.eorc.jaxa.jp/GSMaP/document/new/DataFormatDescription_NRT9.pdf"
DATAFILE_LIMIT_HOURS = 12


def cell_index(latitude, longitude):
    """Geo-linked to the nearest documented GSMaP 0.1° grid center."""
    if not (-60 <= latitude < 60 and -180 <= longitude <= 180):
        raise ValueError("GSMAP_POINT_OUTSIDE_GRID")
    x = round(((longitude % 360) - 0.05) / 0.1) % COLS
    y = round((59.95 - latitude) / 0.1)
    if not (0 <= x < COLS and 0 <= y < ROWS):
        raise ValueError("GSMAP_GRID_INDEX_OUT_OF_RANGE")
    grid_lat = 59.95 - y * 0.1
    grid_lon = ((0.05 + x * 0.1 + 180) % 360) - 180
    lon_error = abs(((longitude - grid_lon + 180) % 360) - 180)
    if abs(latitude - grid_lat) > 0.075 or lon_error > 0.075:
        raise ValueError("GSMAP_CELL_NOT_NEAR_POINT")
    return (y * COLS + x) * 4, round(grid_lat, 5), round(grid_lon, 5)


def parse_product_time(filename):
    match = RE.fullmatch(filename)
    if not match:
        raise ValueError("UNSUPPORTED_GSMAP_NRT_V9_FILENAME")
    date, hour, minute = match.groups()
    try:
        return datetime.strptime(date + hour + minute, "%Y%m%d%H%M").replace(tzinfo=timezone.utc)
    except ValueError:
        raise ValueError("INVALID_GSMAP_UTC_FILE_TIME") from None


def bounded_gzip(path):
    if path.stat().st_size > MAX_COMPRESSED_BYTES:
        raise ValueError("COMPRESSED_FILE_EXCEEDS_LIMIT")
    with gzip.open(path, "rb") as stream:
        data = stream.read(EXACT_BYTES + 1)
        if len(data) != EXACT_BYTES:
            raise ValueError("GSMAP_GRID_DIMENSIONS_MISMATCH")
        if stream.read(1):
            raise ValueError("GSMAP_GZIP_UNEXPECTED_TRAILING_PAYLOAD")
    return data


def validate_file(path, geo_catalogue, now=None):
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("UTC_AWARE_CLOCK_REQUIRED")
    path = Path(path)
    valid_at = parse_product_time(path.name)
    delta = (now - valid_at).total_seconds()
    if delta < 0 or delta > DATAFILE_LIMIT_HOURS * 3600:
        raise ValueError("GSMAP_PRODUCT_STALE_OR_FUTURE")
    catalog = geo_catalogue
    if (catalog.get("contract") != "BLAISE_RJ_IBGE_92_INTERIOR_POINTS_CANDIDATE_V1"
        or len(catalog.get("points", [])) != 92
        or len(set(p["ibge"] for p in catalog["points"])) != 92
        or any(not p.get("verifiedByBackend") for p in catalog["points"])):
        raise ValueError("IBGE_GEOREGISTRY_NOT_VERIFIED")
    raw = bounded_gzip(path)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    rows = []
    for p in catalog["points"]:
        offset, grid_lat, grid_lon = cell_index(p["lat"], p["lon"])
        value, = struct.unpack_from("<f", raw, offset)
        usable = math.isfinite(value) and 0 <= value <= 300
        rows.append({
            "ibge": p["ibge"],
            "gridLat": grid_lat, "gridLon": grid_lon,
            "estimatedRateMmPerHour": round(value, 3) if usable else None,
            "valueStatus": "ESTIMATED_CELL_VALUE" if usable else "NO_VALID_RETRIEVAL",
        })
    usable = sum(1 for p in rows if p["estimatedRateMmPerHour"] is not None)
    return {
        "contract": "BLAISE_JAXA_GSMAP_V9_OFFLINE_NUMERIC_AUDIT_V1",
        "status": "UNPUBLISHED_INTERNAL_NUMERIC_AUDIT",
        "sourceId": SOURCE,
        "nature": "E",
        "dataset": "GSMaP_NRT_ALGORITHM_V9",
        "validAt": valid_at.isoformat().replace("+00:00", "Z"),
        "checkedAt": now.isoformat().replace("+00:00", "Z"),
        "sourceSpecification": DATAFORMAT_URL,
        "fileSha256": digest,
        "municipalityPoints": 92,
        "withNumericEstimate": usable,
        "withoutRetrieval": 92 - usable,
        "qualityFlagsVerified": False,
        "commercialDistributionApproved": False,
        "isPluviometerObservation": False,
        "publishedToAndroid": False,
        "officialAlert": False,
        "requiresRealFileAndFlagChecks": True,
        "points": rows,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, type=Path,
                        help="Authorized real JAXA file; no credentials needed")
    parser.add_argument("--catalog", type=Path,
                        default=Path(__file__).resolve().parents[1] / "src" /
                                "rj-ibge-92-points.json")
    args = parser.parse_args()
    catalogue = json.loads(args.catalog.read_text(encoding="utf-8"))
    report = validate_file(args.file, catalogue)
    # No raw grid, secrets or weather claims go to public client.
    out = Path(__file__).resolve().parents[2] / "evidence" / "international-sources"
    out.mkdir(parents=True, exist_ok=True)
    (out / "jaxa-gsmap-v9-offline-audit.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("BLAISE_JAXA_OFFLINE_AUDIT=" + json.dumps({
        k: v for k, v in report.items() if k != "points"
    }, separators=(",", ":")))


if __name__ == "__main__":
    main()
