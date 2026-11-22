#!/usr/bin/env python3
"""Read-only historical Secret Manager access evidence, no value retrieval.

Lists metadata of version 1 and sanitizes relevant Cloud Audit Logs, if
already enabled. Never enables audit logs, changes IAM, uses impersonation,
calls secretmanager.versions.access, or contacts a weather provider.

No log entries != denial: Data Access logs are often not enabled.
Past success != proof of current IAM.
"""
from __future__ import annotations

import json
import subprocess

PROJECT = "blaise-v6-rj"
SECRET = "blaise-visual-crossing-free-api-key"
PRINCIPAL = "blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com"
FILTER = (
    'protoPayload.serviceName="secretmanager.googleapis.com" AND '
    'protoPayload.methodName:"AccessSecretVersion" AND '
    'protoPayload.authenticationInfo.principalEmail="'
    + PRINCIPAL + '" AND '
    'protoPayload.resourceName:"secrets/' + SECRET + '"'
)


def read_json(*args):
    try:
        p = subprocess.run(
            ["gcloud", *args, "--format=json"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            check=False, timeout=60,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if p.returncode or len(p.stdout) > 2000000:
        return None
    try:
        return json.loads(p.stdout)
    except (ValueError, TypeError):
        return None


def summarize(version, entries):
    valid_state = (
        version.get("state", "").upper()
        if isinstance(version, dict) and isinstance(version.get("state"), str)
        else "NOT_VERIFIED"
    )
    if valid_state not in {"ENABLED", "DISABLED", "DESTROYED"}:
        valid_state = "NOT_VERIFIED"
    good = []
    if isinstance(entries, list):
        for item in entries:
            if not isinstance(item, dict):
                continue
            payload = item.get("protoPayload", {})
            if not isinstance(payload, dict):
                continue
            if payload.get("authenticationInfo", {}).get("principalEmail") != PRINCIPAL:
                continue
            if "secrets/" + SECRET not in str(payload.get("resourceName", "")):
                continue
            if "AccessSecretVersion" not in str(payload.get("methodName", "")):
                continue
            status = payload.get("status") or {}
            if isinstance(status, dict) and status.get("code", 0) == 0:
                stamp = item.get("timestamp")
                if isinstance(stamp, str) and len(stamp) < 90:
                    good.append(stamp)
    return {
        "state": "READ_ONLY_EVIDENCE_REVIEW_COMPLETE",
        "secretVersionOneState": valid_state,
        "auditLoggingQuery": "READ" if isinstance(entries, list) else "UNAVAILABLE",
        "historicalSuccessfulAccessCountInReturnedWindow": len(good),
        "mostRecentSuccessfulAccessTimestamp": max(good) if good else None,
        "zeroLogsDoesNotProveDenial": True,
        "historicalAccessDoesNotProveCurrentAuthorization": True,
        "effectiveAccessNow": "NOT_VERIFIED",
        "secretVersionPayloadRead": False,
        "cloudRunModified": False,
        "iamModified": False,
        "providerCalled": False,
        "releaseApproved": False,
    }


def main():
    version = read_json(
        "secrets", "versions", "describe", "1",
        "--secret=" + SECRET, "--project=" + PROJECT
    )
    entries = read_json(
        "logging", "read", FILTER,
        "--project=" + PROJECT,
        "--freshness=30d", "--limit=50"
    )
    print("BLAISE_VC_ACCESS_EVIDENCE_READONLY=" + json.dumps(
        summarize(version, entries), sort_keys=True, separators=(",", ":")
    ))


if __name__ == "__main__":
    main()
