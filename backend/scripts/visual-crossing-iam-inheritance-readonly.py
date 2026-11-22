#!/usr/bin/env python3
"""Blaise V6 RJ — conservative, read-only review of Visual Crossing IAM.

Reads existing gcloud IAM policies only; never enables APIs, modifies a grant,
retrieves a secret VERSION, requests provider data, or touches Firestore records.

IMPORTANT: Policy listing alone cannot resolve Google Group membership,
principal access boundaries, IAM Conditions, custom role permissions or every
permission deny. Therefore no successful output ever asserts full release.
"""
from __future__ import annotations

import json
import subprocess
import sys

PROJECT = "blaise-v6-rj"
SECRET = "blaise-visual-crossing-free-api-key"
ACCOUNTS = (
    "blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com",
    "blaise-noaa-staging@blaise-v6-rj.iam.gserviceaccount.com",
)
MAX_OUTPUT = 2_000_000


def _run(*args):
    """Do not print stderr: it may disclose policy details or account names."""
    try:
        result = subprocess.run(
            ["gcloud", *args, "--format=json"],
            capture_output=True, text=True, check=False, timeout=75,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None, "COMMAND_UNAVAILABLE_OR_TIMEOUT"
    if result.returncode:
        err = (result.stderr or "")[:3000].lower()
        if "permission_denied" in err or "permission denied" in err:
            return None, "IAM_READ_PERMISSION_DENIED"
        if "service_disabled" in err or "has not been used" in err:
            return None, "REQUIRED_EXISTING_API_UNAVAILABLE"
        return None, "POLICY_READ_FAILED"
    if len(result.stdout) > MAX_OUTPUT:
        return None, "POLICY_TOO_LARGE"
    try:
        return json.loads(result.stdout), None
    except (ValueError, TypeError):
        return None, "INVALID_GCLOUD_JSON"


def _collect_hierarchy():
    """Prefer the official one-command project+ancestors allow/deny read."""
    data, err = _run("projects", "get-ancestors-iam-policy", PROJECT, "--include-deny")
    if err is None and isinstance(data, list):
        return data, "PROJECT_ANCESTORS_ALLOW_DENY", True, []
    # Avoid turning deny-policy read failure into a misleading green verdict.
    errors = ["ANCESTOR_DENY_POLICIES_UNVERIFIED"]
    data, err2 = _run("projects", "get-ancestors-iam-policy", PROJECT)
    if err2 is None and isinstance(data, list):
        return data, "PROJECT_ANCESTORS_ALLOW_ONLY", False, errors
    errors.append("ANCESTORS_POLICY_COMMAND_UNAVAILABLE")
    # Fallback to ordinary Resource Manager methods already in use.
    project_policy, pe = _run("projects", "get-iam-policy", PROJECT)
    if pe is not None or not isinstance(project_policy, dict):
        errors.append("PROJECT_IAM_NOT_READABLE")
        return [], "UNAVAILABLE", False, errors
    items = [{"type": "project", "id": PROJECT, "policy": project_policy}]
    ancestors, ae = _run("projects", "get-ancestors", PROJECT)
    if ae or not isinstance(ancestors, list):
        errors.append("FOLDER_OR_ORGANIZATION_HIERARCHY_UNVERIFIED")
        return items, "PROJECT_ONLY", False, errors
    for ancestor in ancestors:
        if not isinstance(ancestor, dict):
            errors.append("ANCESTOR_RECORD_INVALID")
            continue
        kind = ancestor.get("type")
        identifier = str(ancestor.get("id", ""))
        if kind == "project":
            continue
        if kind == "folder" and identifier.isdigit():
            policy, reason = _run(
                "resource-manager", "folders", "get-iam-policy", identifier
            )
        elif kind == "organization" and identifier.isdigit():
            policy, reason = _run(
                "organizations", "get-iam-policy", identifier
            )
        else:
            errors.append("ANCESTOR_TYPE_UNKNOWN")
            continue
        if reason or not isinstance(policy, dict):
            errors.append("PARENT_POLICY_NOT_READABLE:" + kind)
        else:
            items.append({"type": kind, "id": identifier, "policy": policy})
    return items, "FALLBACK_RESOURCE_MANAGER", False, errors


def _scope(item):
    kind = str(item.get("type", "unknown")).lower()
    if kind in {"project", "folder", "organization"}:
        return kind
    return "unknown"


def analyze(entries, secret_policy):
    roles = {a: [] for a in ACCOUNTS}
    broad = []
    dynamic = []
    conditions = 0
    deny_count = 0
    unknown_entries = 0
    for item in [*entries, {"type": "secret", "policy": secret_policy}]:
        if not isinstance(item, dict):
            unknown_entries += 1
            continue
        policy = item.get("policy")
        if not isinstance(policy, dict):
            unknown_entries += 1
            continue
        scope = _scope(item) if item.get("type") != "secret" else "secret"
        if policy.get("kind") == "DenyPolicy" or "denyPolicy" in item:
            deny_count += 1
            continue
        for binding in policy.get("bindings", []):
            if not isinstance(binding, dict):
                unknown_entries += 1
                continue
            role = binding.get("role", "")
            members = binding.get("members", [])
            if not isinstance(members, list) or not isinstance(role, str):
                unknown_entries += 1
                continue
            if binding.get("condition"):
                conditions += 1
            for account in ACCOUNTS:
                if "serviceAccount:" + account in members:
                    roles[account].append({
                        "scope": scope, "role": role,
                        "conditional": bool(binding.get("condition"))
                    })
            for m in members:
                if m in ("allUsers", "allAuthenticatedUsers"):
                    broad.append({"scope": scope, "memberType": m, "role": role})
                elif isinstance(m, str) and m.startswith(
                    ("group:", "domain:", "principalSet:", "principal:", "deleted:")
                ):
                    dynamic.append({
                        "scope": scope, "memberType": m.split(":", 1)[0],
                        "role": role,
                    })
    return {
        "serviceAccountExplicitAllowBindings": roles,
        "broadAllowBindings": broad,
        "dynamicOrGroupBindings": dynamic,
        "iamConditionsCount": conditions,
        "denyPolicyObjectsSeen": deny_count,
        "unrecognizedPolicyItemsCount": unknown_entries,
    }


def main():
    entries, coverage, deny_checked, issues = _collect_hierarchy()
    secret, secret_err = _run(
        "secrets", "get-iam-policy", SECRET, "--project=" + PROJECT
    )
    if secret_err or not isinstance(secret, dict):
        issues.append("SECRET_DIRECT_POLICY_NOT_READABLE")
        secret = {"bindings": []}
    result = analyze(entries, secret)
    result.update({
        "project": PROJECT,
        "policyLevelsRead": [
            {"scope": _scope(e)} for e in entries if isinstance(e, dict)
        ],
        "coverage": coverage,
        "denyPoliciesQueryCompleted": deny_checked,
        "secretDirectPolicyRead": secret_err is None,
        "issues": issues,
        "readOnly": True,
        "secretValueRead": False,
        "weatherApiCalls": 0,
        "productionChanged": False,
        "clientPublished": False,
        "effectiveSecretAccess": "NOT_CONCLUSIVELY_EVALUATED",
        "releaseApproved": False,
    })
    # Never serialize raw IAM JSON or group member identities.
    print("BLAISE_VC_INHERITED_IAM_AUDIT=" + json.dumps(
        result, ensure_ascii=True, separators=(",", ":"), sort_keys=True
    ))
    return 0 if not issues else 2


if __name__ == "__main__":
    sys.exit(main())
