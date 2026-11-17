#!/usr/bin/env python3
"""One-shot GSMaP v9 staging validation.

Stage 1: check AUTH TLS capability on the public JAXA Rainfall Watch FTP host.
Stage 2 (only if operator securely sets env credentials): list <=200 names in the
documented `realtime_ver/v9/latest` directory. No files downloaded by default.
No plaintext FTP downgrade, no secrets in stdout/exception report, no Android
access, no persistent runtime. No commercial publication authorization implied.

Usage:
  python3 backend/scripts/probe-jaxa-gsmap-staging.py --live
  # With JAXA_GSMAP_FTP_USERNAME and JAXA_GSMAP_FTP_PASSWORD in the runner:
  python3 backend/scripts/probe-jaxa-gsmap-staging.py --live --list-only

The official JAXA FAQ lists algorithm v9 in /realtime_ver/v9/latest.
"""
from __future__ import annotations

import argparse
import ftplib
import json
import os
import socket
from datetime import datetime, timezone
from pathlib import Path

HOST = "hokusai.eorc.jaxa.jp"
PORT = 21
DOC = "https://sharaku.eorc.jaxa.jp/GSMaP/faq/GSMaP_faq01.html"
DIR = "/realtime_ver/v9/latest"
MAX_ENTRIES = 200
MAX_NAME_LEN = 150
TIMEOUT_S = 12


def classify_product(filename: str) -> str | None:
    """Classification is conservative: names are not proof of usable data."""
    name = filename.rsplit("/", 1)[-1].lower()
    if not name or len(name) > MAX_NAME_LEN:
        return None
    if name.endswith((".dat.gz", ".nc", ".nc4", ".nc.gz")):
        if "gauge" in name or "_g_" in name or "gauge_nrt" in name:
            return "GSMAP_GAUGE_NRT_V9_CANDIDATE"
        if "nrt" in name or "gsmap" in name:
            return "GSMAP_NRT_V9_CANDIDATE"
    return None


def check_jaxa_ftp(*, username: str | None = None,
                   password: str | None = None,
                   ftp_factory=ftplib.FTP_TLS):
    """No secrets are logged, echoed or added to error messages."""
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    result = {
        "contract": "BLAISE_JAXA_GSMAP_V9_STAGING_FTPS_V1",
        "checkedAt": now,
        "provider": "JAXA_GSMAP",
        "host": HOST,
        "version": "ALGORITHM_V9",
        "officialDirectory": DIR,
        "sourceDocumentation": DOC,
        "nature": "E",
        "state": "UNAVAILABLE",
        "secureTransportConfirmed": False,
        "credentialsUsed": False,
        "filesDownloaded": 0,
        "meteorologicalValueValidated": False,
        "publishedToAndroid": False,
        "productionChanged": False,
        "sampleFiles": [],
    }
    ftp = None
    try:
        ftp = ftp_factory(timeout=TIMEOUT_S)
        ftp.connect(HOST, PORT, timeout=TIMEOUT_S)
        # Must negotiate encryption BEFORE any login, even for shared
        # distribution credentials. Fail-closed; no FTP plaintext fallback.
        ftp.auth()
        ftp.prot_p()
        result["secureTransportConfirmed"] = True
        if not username or not password:
            result["state"] = "FTPS_READY_CREDENTIALS_NOT_CONFIGURED"
            return result

        # No ftp user/password in result, errors or logs.
        result["credentialsUsed"] = True
        ftp.login(username, password)
        names = ftp.nlst(DIR)
        if len(names) > MAX_ENTRIES:
            result["state"] = "DIRECTORY_TOO_LARGE_FOR_REVIEW"
            return result
        # No full raw directory dump; file names carry no user credentials.
        candidates = []
        for name in names:
            label = classify_product(name)
            if label:
                candidates.append({"name": name.rsplit("/", 1)[-1],
                                   "kind": label})
        result["sampleFiles"] = candidates[:8]
        result["state"] = ("V9_DIRECTORY_LISTED_NO_NUMERIC_FIELD" if candidates
                           else "V9_DIRECTORY_LISTED_NO_MATCHING_FILE")
        return result
    except (ftplib.Error, OSError, ValueError, socket.timeout):
        result["state"] = ("FTPS_OR_DIRECTORY_UNAVAILABLE" if result[
            "secureTransportConfirmed"] else "FTPS_UNSUPPORTED_OR_UNREACHABLE")
        return result
    finally:
        if ftp is not None:
            try:
                ftp.close()
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args()
    if not args.live:
        parser.error("--live required; no network requests made")
    username = os.environ.get("JAXA_GSMAP_FTP_USERNAME")
    password = os.environ.get("JAXA_GSMAP_FTP_PASSWORD")
    report = check_jaxa_ftp(username=username, password=password)
    dest = (Path(__file__).resolve().parents[2] /
            "evidence" / "international-sources")
    dest.mkdir(parents=True, exist_ok=True)
    out = dest / "jaxa-gsmap-v9-ftps-probe.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    print("BLAISE_JAXA_FTPS_RESULT=" + json.dumps(report, separators=(",", ":")))


if __name__ == "__main__":
    main()
