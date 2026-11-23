#!/usr/bin/env python3
"""Blaise V6 RJ — private WeatherAPI V2 / Firestore IAM metadata preflight.

READ ONLY. Never reads secret payloads, Firestore documents, data from a
weather provider, credentials, access tokens or client records. Never
modifies IAM, Cloud Run, Firestore, collection quota or production traffic.
This is METADATA evidence, not a proof of effective Firestore access.
"""
from __future__ import annotations

import json
import subprocess

PROJECT = "blaise-v6-rj"
ACCOUNT = "blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com"
SECRET = "blaise-weatherapi-free-api-key"
MAX_BYTES = 2_000_000
DATASTORE_ROLES = (
    "roles/datastore.", "roles/firestore."
)
BROADER_ROLES = frozenset((
    "roles/editor", "roles/owner", "roles/firebase.admin",
    "roles/firebase.developAdmin",
))
SENSITIVE_BINDING_TYPES = ("group:", "domain:", "principal:", "principalSet:")
ROLE_PREFIX = ("roles/", "projects/", "organizations/")


def read_metadata(*args):
    """Never serialize provider names, stderr, raw IAM JSON or token output."""
    try:
        result = subprocess.run(
            ["gcloud", *args, "--format=json"],
            capture_output=True, text=True, timeout=65, check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None, "COMMAND_UNAVAILABLE"
    if result.returncode:
        return None, "POLICY_OR_METADATA_UNAVAILABLE"
    if len(result.stdout) > MAX_BYTES:
        return None, "METADATA_TOO_LARGE"
    try:
        return json.loads(result.stdout), None
    except (ValueError, TypeError):
        return None, "INVALID_METADATA_JSON"


def classify_bindings(entries, account=ACCOUNT):
    """Enumerate explicit grants; never mistake them for effective permission.

    Each input row: {type: project|folder|organization, policy:{bindings:[]}}.
    Unknown policy shapes and IAM group grants are signaled as unresolved.
    """
    if not isinstance(entries, list):
        return {"roles": [], "conditionalRoleCount": 0,
                "groupOrDynamicBindingCount": 0,
                "broadBindingCount": 0,
                "unrecognizedPolicyObjects": 1,
                "denyPolicyObjectsSeen": 0,
                "rolesMayBeIncomplete": True}
    roles = []
    dynamic = 0
    broad = 0
    unknown = 0
    conditions = 0
    denials = 0
    for item in entries:
        if not isinstance(item, dict):
            unknown += 1
            continue
        if item.get("kind") == "DenyPolicy" or "denyPolicy" in item:
            denials += 1
            continue
        policy = item.get("policy")
        if not isinstance(policy, dict):
            unknown += 1
            continue
        scope = str(item.get("type", "unknown")).lower()
        if scope not in ("project", "folder", "organization"):
            scope = "unknown"
        bindings = policy.get("bindings", [])
        if not isinstance(bindings, list):
            unknown += 1
            continue
        for binding in bindings:
            if not isinstance(binding, dict):
                unknown += 1
                continue
            role = binding.get("role")
            members = binding.get("members")
            if not isinstance(role, str) or not isinstance(members, list):
                unknown += 1
                continue
            conditional = bool(binding.get("condition"))
            if conditional:
                conditions += 1
            if "serviceAccount:" + account in members:
                roles.append({"scope": scope, "role": role,
                              "conditional": conditional})
            dynamic += sum(isinstance(m, str) and
                           m.startswith(SENSITIVE_BINDING_TYPES)
                           for m in members)
            broad += sum(m in ("allUsers", "allAuthenticatedUsers")
                         for m in members)
    unique = sorted({(r["scope"], r["role"], r["conditional"])
                     for r in roles})
    return {
        "roles": [
            {"scope": scope, "role": role, "conditional": conditional}
            for scope, role, conditional in unique
        ],
        "conditionalRoleCount": conditions,
        "groupOrDynamicBindingCount": dynamic,
        "broadBindingCount": broad,
        "unrecognizedPolicyObjects": unknown,
        "denyPolicyObjectsSeen": denials,
        "rolesMayBeIncomplete": bool(unknown or dynamic),
    }


def interpret_roles(result):
    roles = result["roles"]
    datastore = [r for r in roles if
                 r["role"].startswith(DATASTORE_ROLES)]
    broader = [r for r in roles if r["role"] in BROADER_ROLES]
    custom = [r for r in roles if
              r["role"].startswith(("projects/", "organizations/"))]
    return {
        "directOrInheritedDatastoreRoleBindings": datastore,
        "potentiallyBroaderRoleBindings": broader,
        "customRoleBindingsRequireInspection": custom,
        "firestoreEffectiveAccess": "NOT_PROVEN_BY_IAM_POLICY_LISTING",
        "permissionDeniedConcluded": False,
        "permissionGrantedConcluded": False,
        "clientSdkFirestoreRulesProveServerIam": False,
    }


def _scope(entries):
    return [item.get("type", "unknown")
            for item in entries if isinstance(item, dict)]


def main():
    # Include deny policies when supported. If unavailable, fall back to
    # ordinary hierarchy then project IAM, without assuming completeness.
    entries, ancestor_error = read_metadata(
        "projects", "get-ancestors-iam-policy", PROJECT, "--include-deny"
    )
    coverage = "PROJECT_ANCESTORS_ALLOW_AND_DENY"
    deny_checked = ancestor_error is None and isinstance(entries, list)
    issues = []
    if not deny_checked:
        issues.append("DENY_POLICIES_NOT_FULLY_VERIFIED")
        entries, ancestor_error = read_metadata(
            "projects", "get-ancestors-iam-policy", PROJECT
        )
        coverage = "PROJECT_ANCESTORS_ALLOW_ONLY"
    if ancestor_error or not isinstance(entries, list):
        issues.append("INHERITED_POLICIES_NOT_FULLY_VERIFIED")
        project, project_error = read_metadata(
            "projects", "get-iam-policy", PROJECT
        )
        entries = [{"type": "project", "policy": project}] if (
            project_error is None and isinstance(project, dict)) else []
        coverage = "PROJECT_ONLY" if entries else "POLICY_UNAVAILABLE"
    analysis = classify_bindings(entries)
    if analysis["unrecognizedPolicyObjects"]:
        issues.append("UNRECOGNIZED_IAM_POLICY_SHAPE")
    secret, secret_error = read_metadata(
        "secrets", "get-iam-policy", SECRET, "--project=" + PROJECT
    )
    secret_version, version_error = read_metadata(
        "secrets", "versions", "describe", "2",
        "--secret=" + SECRET, "--project=" + PROJECT
    )
    database, database_error = read_metadata(
        "firestore", "databases", "describe",
        "--database=(default)", "--project=" + PROJECT
    )
    secret_direct = False
    secret_conditional = False
    if isinstance(secret, dict):
        matching = [b for b in secret.get("bindings", [])
                    if isinstance(b, dict)
                    and b.get("role") == "roles/secretmanager.secretAccessor"
                    and "serviceAccount:" + ACCOUNT in b.get("members", [])]
        secret_direct = bool(matching)
        secret_conditional = any(bool(b.get("condition")) for b in matching)
    if any((secret_error, version_error, database_error)):
        issues.append("SOME_RESOURCE_METADATA_UNAVAILABLE")
    parsed = interpret_roles(analysis)
    report = {
        "status": "MANUAL_REVIEW_REQUIRED",
        "project": PROJECT,
        "runtimePrincipal": "BLAISE_CLOUD_RUN_RUNTIME",
        "policyCoverage": coverage,
        "policyScopesSeen": _scope(entries),
        "ancestorDenyPolicyMetadataRead": deny_checked,
        "firestoreDatabaseMetadataFound": bool(
            isinstance(database, dict) and database.get("name")),
        "firestoreDatabaseType": (
            database.get("type", "UNKNOWN")
            if isinstance(database, dict) else "UNKNOWN"
        ),
        "weatherApiSecretV2State": (
            secret_version.get("state", "UNKNOWN")
            if isinstance(secret_version, dict) else "UNKNOWN"
        ),
        "weatherApiSecretAccessorDirect": secret_direct,
        "weatherApiDirectGrantConditional": secret_conditional,
        "secretEffectiveVersionAccess": "NOT_TESTED_NO_PAYLOAD_ACCESS",
        **analysis, **parsed,
        "issues": sorted(set(issues)),
        "onlyMetadataRead": True,
        "firestoreDocumentsRead": False,
        "secretValueRead": False,
        "providerCalls": 0,
        "creditReservations": 0,
        "iamModified": False,
        "productionChanged": False,
        "clientDataReleased": False,
        "productionDeployApproved": False,
    }
    print("RJ_WA_FIRESTORE_IAM_PREFLIGHT=" +
          json.dumps(report, separators=(",", ":"), sort_keys=True))
    return 0 if not issues else 2


if __name__ == "__main__":
    raise SystemExit(main())
