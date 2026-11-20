#!/usr/bin/env python3
"""Read-only IAM inventory for the Cloud Build default identity and VC repository.

No keys, tokens, account email output, policy dump, secret access, IAM writes,
build submissions, Cloud Run changes, or provider calls. Direct project/repo
bindings only; inherited or effective IAM is NOT established.
"""
from __future__ import annotations
import json
import subprocess

PROJECT = "blaise-v6-rj"
REGION = "southamerica-east1"
REPOSITORY = "blaise-vc-proof"


def read_json(*args):
    try:
        r = subprocess.run(["gcloud", *args, "--format=json"],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                           text=True, timeout=50, check=False)
        if r.returncode or len(r.stdout) > 1500000:
            return None
        return json.loads(r.stdout)
    except (OSError, subprocess.TimeoutExpired, ValueError):
        return None


def get_identity(raw):
    if isinstance(raw, str):
        candidate = raw
    elif isinstance(raw, dict):
        candidate = (raw.get("serviceAccountEmail") or raw.get("serviceAccount")
                     or raw.get("email") or "")
    else:
        return None
    if not isinstance(candidate, str):
        return None
    candidate = candidate.rsplit("/serviceAccounts/", 1)[-1]
    if candidate.endswith("-compute@developer.gserviceaccount.com") and (
            "/" not in candidate and " " not in candidate):
        return candidate
    return None


def summarize(identity_raw, project_policy, repo_policy):
    identity = get_identity(identity_raw)
    member = "serviceAccount:" + identity if identity else None

    def bindings(policy):
        if not member or not isinstance(policy, dict):
            return []
        return [b for b in policy.get("bindings", [])
                if isinstance(b, dict) and member in b.get("members", [])]

    project_bindings = bindings(project_policy)
    repo_bindings = bindings(repo_policy)
    proj_roles = {b.get("role") for b in project_bindings}
    repo_roles = {b.get("role") for b in repo_bindings}
    return {
        "state": "READ_ONLY_BUILD_IDENTITY_IAM",
        "defaultIdentityRecognized": bool(identity),
        "projectPolicyRead": isinstance(project_policy, dict),
        "targetRepositoryPolicyRead": isinstance(repo_policy, dict),
        "projectDirectBindingCount": len(project_bindings),
        "repositoryDirectBindingCount": len(repo_bindings),
        "projectEditorOrOwnerDirect": bool(
            {"roles/editor", "roles/owner"} & proj_roles),
        "projectArtifactWriterDirect": (
            "roles/artifactregistry.writer" in proj_roles),
        "repositoryArtifactWriterDirect": (
            "roles/artifactregistry.writer" in repo_roles),
        "projectConditionalBindingCount": sum(
            bool(b.get("condition")) for b in project_bindings),
        "repositoryConditionalBindingCount": sum(
            bool(b.get("condition")) for b in repo_bindings),
        "effectiveArtifactUploadPermission": "NOT_VERIFIED",
        "buildInvokerActAsPermission": "NOT_VERIFIED",
        "inheritedAndDenyPolicies": "NOT_EVALUATED",
        "remainingFreeBuildMinutes": "NOT_VERIFIED",
        "billingMayApply": True,
        "noIamModified": True,
        "noBuildSubmitted": True,
        "noSecretRead": True,
        "noCloudRunJobCreated": True,
    }


def main():
    identity = read_json("builds", "get-default-service-account",
                         "--project=" + PROJECT, "--region=" + REGION)
    project = read_json("projects", "get-iam-policy", PROJECT)
    repo = read_json("artifacts", "repositories", "get-iam-policy", REPOSITORY,
                     "--project=" + PROJECT, "--location=" + REGION)
    print("BLAISE_VC_BUILD_IDENTITY_IAM=" +
          json.dumps(summarize(identity, project, repo),
                     sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
