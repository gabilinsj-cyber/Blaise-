#!/usr/bin/env python3
"""Visual Crossing — read-only readiness check for dedicated Cloud Run Job.

No service-account creation, IAM grant, Cloud Run job creation or execution,
Secret Manager version access, provider requests, secret value printing,
Cloud Shell credential modification or billing changes.

Only summaries from existing Google Cloud metadata. A missing resource or
policy might mean permission denied, so this never claims definitively
that the account or job does not exist.
"""
from __future__ import annotations
import json
import subprocess

PROJECT = "blaise-v6-rj"
ACCOUNT = "blaise-vc-proof@blaise-v6-rj.iam.gserviceaccount.com"
SECRET = "blaise-visual-crossing-free-api-key"
JOB = "blaise-vc-secret-proof-once"


def read_json(*args):
    try:
        p = subprocess.run(
            ["gcloud", *args, "--format=json"],
            capture_output=True, text=True, check=False, timeout=60,
        )
        if p.returncode or len(p.stdout) > 1_500_000:
            return None
        return json.loads(p.stdout)
    except (OSError, subprocess.TimeoutExpired, ValueError, TypeError):
        return None


def summarize(identity, policy, jobs):
    direct_roles = []
    conditional_roles = 0
    if isinstance(policy, dict):
        for b in policy.get("bindings", []):
            if not isinstance(b, dict):
                continue
            if "serviceAccount:" + ACCOUNT in b.get("members", []):
                if b.get("role") == "roles/secretmanager.secretAccessor":
                    direct_roles.append("secretAccessor")
                    if b.get("condition"):
                        conditional_roles += 1

    if isinstance(jobs, list):
        job_matches = 0
        for job in jobs:
            if not isinstance(job, dict):
                continue
            name = job.get("metadata", {}).get("name", "")
            if not name:
                name = job.get("name", "").split("/")[-1]
            if name == JOB:
                job_matches += 1
        job_state = "MATCH_FOUND" if job_matches else "NO_MATCH_IN_RESULTS"
    else:
        job_state = "LIST_NOT_AVAILABLE"

    return {
        "state": "READ_ONLY_ISOLATED_PROOF_PREFLIGHT",
        "proposedIdentity": ACCOUNT,
        "identityDescribeSucceeded": isinstance(identity, dict),
        "identityExistenceIfDescribeFailed": "UNKNOWN",
        "secretPolicyReadSucceeded": isinstance(policy, dict),
        "directSecretAccessorBindingFound": bool(direct_roles),
        "directSecretAccessorBindingConditionalCount": conditional_roles,
        "effectiveSecretAccess": "NOT_VERIFIED",
        "proposedJob": JOB,
        "cloudRunJobs": job_state,
        "jobCreatedByThisCheck": False,
        "cloudRunExecutionTriggered": False,
        "serviceAccountCreated": False,
        "secretPayloadRead": False,
        "iamPolicyChanged": False,
        "weatherApiCalled": False,
        "releaseApproved": False,
    }


def main():
    identity = read_json(
        "iam", "service-accounts", "describe", ACCOUNT,
        "--project=" + PROJECT,
    )
    policy = read_json(
        "secrets", "get-iam-policy", SECRET, "--project=" + PROJECT,
    )
    jobs = read_json("run", "jobs", "list", "--project=" + PROJECT)
    # Do not print gcloud stderr, credentials, raw IAM documents, or URLs.
    print("BLAISE_VC_ISOLATED_PROOF_PREFLIGHT=" + json.dumps(
        summarize(identity, policy, jobs),
        separators=(",", ":"), sort_keys=True,
    ))


if __name__ == "__main__":
    main()
