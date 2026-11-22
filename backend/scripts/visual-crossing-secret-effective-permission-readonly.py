#!/usr/bin/env python3
"""Visual Crossing — non-disclosing account-identity permission preflight.

No IAM changes, API enabling, secret version reads, Firestore writes or
weather-provider requests. Attempts short-lived impersonation of the actual
Cloud Run service account (only if the caller ALREADY has permission), then
calls Secret Manager projects.secrets.testIamPermissions under THAT identity.

IMPORTANT: Google's testIamPermissions is only an advisory UI capability;
it may fail open. The result is NOT proof that versions.access really works
for a particular secret version. Do NOT use it as a production release gate.
"""
from __future__ import annotations

import json
import os
import subprocess
import urllib.error
import urllib.request

PROJECT = "blaise-v6-rj"
ACCOUNT = "blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com"
SECRET = "blaise-visual-crossing-free-api-key"
PERMISSION = "secretmanager.versions.access"
API_URL = (
    "https://secretmanager.googleapis.com/v1/projects/"
    + PROJECT + "/secrets/" + SECRET + ":testIamPermissions"
)


def summary(state, **extra):
    return {
        "state": state,
        "testedPrincipal": "BLAISE_CLOUD_RUN_RUNTIME",
        "requestedPermission": PERMISSION,
        "resource": SECRET,
        "secretValueRead": False,
        "apiKeyDisplayed": False,
        "accessTokenDisplayed": False,
        "iamPolicyModified": False,
        "serviceEnabled": False,
        "meteorologicalProviderCalls": 0,
        "productionChanged": False,
        "subscriberPublishingEnabled": False,
        "releaseApproved": False,
        "testIamPermissionsIsAdvisory": True,
        **extra,
    }


def evaluate_permissions(body):
    """Only a positive exact permission match can be described as reported."""
    if not isinstance(body, dict):
        return summary("INVALID_PERMISSION_RESPONSE")
    permissions = body.get("permissions", [])
    if not isinstance(permissions, list) or any(
        not isinstance(p, str) for p in permissions
    ):
        return summary("INVALID_PERMISSION_RESPONSE")
    if PERMISSION in permissions:
        return summary(
            "PERMISSION_REPORTED_BY_API",
            caveat="NOT_AUTHORIZATION_PROOF_TEST_IAM_PERMISSIONS_MAY_FAIL_OPEN",
        )
    return summary(
        "PERMISSION_NOT_REPORTED",
        caveat="NOT_A_CONCLUSIVE_DENIAL_OF_VERSION_ACCESS",
    )


def run_probe():
    env = {**os.environ, "CLOUDSDK_CORE_DISABLE_PROMPTS": "1"}
    try:
        result = subprocess.run(
            [
                "gcloud", "--quiet", "auth", "print-access-token",
                "--impersonate-service-account=" + ACCOUNT,
            ],
            capture_output=True,
            text=True,
            timeout=35,
            check=False,
            env=env,
        )
    except (OSError, subprocess.TimeoutExpired):
        return summary("IMPERSONATION_COMMAND_UNAVAILABLE")
    if result.returncode:
        # Never print stdout/stderr; they may include the short-lived token,
        # user identifiers or implementation/permission details.
        return summary(
            "SERVICE_ACCOUNT_IMPERSONATION_UNAVAILABLE",
            caveat="CANNOT_INFER_SECRET_ACCESS_FROM_IMPERSONATION_FAILURE",
        )
    access_token = result.stdout.strip()
    if len(access_token) < 40 or any(x.isspace() for x in access_token):
        return summary("IMPERSONATED_TOKEN_INVALID")
    payload = json.dumps({"permissions": [PERMISSION]}).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Authorization": "Bearer " + access_token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read(12000)
        return evaluate_permissions(json.loads(body.decode("utf-8")))
    except urllib.error.HTTPError as exc:
        # Do not show response body or request headers, even for failures.
        return summary(
            "SECRET_MANAGER_PERMISSION_TEST_UNAVAILABLE",
            httpStatus=exc.code,
            caveat="HTTP_FAILURE_IS_NOT_A_SECRET_ACCESS_VERDICT",
        )
    except (urllib.error.URLError, TimeoutError, ValueError, UnicodeError):
        return summary("SECRET_MANAGER_PERMISSION_TEST_FAILED")
    finally:
        access_token = ""


if __name__ == "__main__":
    print("BLAISE_VC_BACKEND_SECRET_PERMISSION=" + json.dumps(
        run_probe(), sort_keys=True, separators=(",", ":")
    ))
