#!/usr/bin/env python3
"""Read-only preflight of the Cloud Build path for the isolated VC image.

Never invokes builds.submit, services.enable, IAM mutation, Docker, jobs,
Secret Manager access, billing mutations or weather API. The result is a
limited inventory, NOT authorization to spend funds or a proof of IAM.
"""
from __future__ import annotations
import json
import subprocess

PROJECT = "blaise-v6-rj"
REGION = "southamerica-east1"
REPOSITORY = "blaise-vc-proof"


def run_json(*args):
    try:
        p = subprocess.run(
            ["gcloud", *args, "--format=json"],
            capture_output=True, text=True, check=False, timeout=40)
        if p.returncode or len(p.stdout) > 1_000_000:
            return None
        return json.loads(p.stdout)
    except (ValueError, OSError, subprocess.TimeoutExpired):
        return None


def classify_default_identity(raw):
    if isinstance(raw, str):
        account = raw
    elif isinstance(raw, dict):
        account = (raw.get("serviceAccount") or raw.get("email")
                   or raw.get("name") or "")
    else:
        account = ""
    if not isinstance(account, str) or not account:
        return "UNAVAILABLE"
    if "cloudbuild.gserviceaccount.com" in account:
        return "CLOUD_BUILD_LEGACY"
    if "-compute@developer.gserviceaccount.com" in account:
        return "COMPUTE_ENGINE_DEFAULT"
    return "OTHER_OR_UNRECOGNIZED"


def summarize(services, billing, default_sa, repo, repo_policy):
    names = set()
    if isinstance(services, list):
        for s in services:
            if not isinstance(s, dict):
                continue
            name = (
                s.get("config", {}).get("name")
                or s.get("name", "").split("/")[-1]
            )
            if isinstance(name, str):
                names.add(name.split("/")[-1])
    bill = billing.get("billingEnabled") if isinstance(billing, dict) else None
    repo_name = (
        repo.get("name", "").split("/")[-1]
        if isinstance(repo, dict) else None
    )
    return {
        "state": "READ_ONLY_BUILD_PREFLIGHT",
        "cloudBuildApi": ("ENABLED" if "cloudbuild.googleapis.com" in names
                          else "NOT_FOUND_IN_ENABLED_LIST"
                          if isinstance(services, list) else "UNKNOWN"),
        "artifactRegistryApi": (
            "ENABLED" if "artifactregistry.googleapis.com" in names
            else "NOT_FOUND_IN_ENABLED_LIST"
            if isinstance(services, list) else "UNKNOWN"
        ),
        "billing": ("ENABLED" if bill is True else "DISABLED"
                    if bill is False else "UNKNOWN"),
        "defaultBuildIdentityType": classify_default_identity(default_sa),
        "targetRepositoryConfirmed": (
            isinstance(repo, dict) and repo_name == REPOSITORY
            and repo.get("format") == "DOCKER"
        ),
        "repositoryIamPolicyVisible": isinstance(repo_policy, dict),
        "effectiveArtifactUploadPermission": "NOT_VERIFIED",
        "remainingFreeBuildMinutes": "NOT_VERIFIED",
        "billingMayApply": True,
        "noIamRolesGranted": True,
        "noApisEnabled": True,
        "buildNotSubmitted": True,
        "imageNotUploaded": True,
        "cloudRunJobNotCreated": True,
        "secretNotRead": True,
    }


def main():
    services = run_json("services", "list", "--enabled",
                        "--project=" + PROJECT)
    billing = run_json("billing", "projects", "describe", PROJECT)
    account = run_json("builds", "get-default-service-account",
                       "--project=" + PROJECT, "--region=" + REGION)
    repo = run_json("artifacts", "repositories", "describe", REPOSITORY,
                    "--project=" + PROJECT, "--location=" + REGION)
    repo_policy = run_json("artifacts", "repositories", "get-iam-policy",
                           REPOSITORY, "--project=" + PROJECT,
                           "--location=" + REGION)
    report = summarize(services, billing, account, repo, repo_policy)
    print("BLAISE_VC_BUILD_PREFLIGHT=" +
          json.dumps(report, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
