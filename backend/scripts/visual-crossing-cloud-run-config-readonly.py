#!/usr/bin/env python3
"""Safe read-only check of deployed Cloud Run Visual Crossing config.

Only reads Cloud Run service metadata. Never prints environment values, secrets,
tokens, URL query strings, full service YAML or IAM policy. No provider calls,
deploy, service restart, Secret Manager version access, or role changes.
"""
import json
import subprocess

PROJECT = "blaise-v6-rj"
NAME = "blaise-v6-rj-backend"
SECRET = "blaise-visual-crossing-free-api-key"
ENV_KEY = "BLAISE_VISUAL_CROSSING_FREE_API_KEY"

def gc(*args):
    try:
        result = subprocess.run(
            ["gcloud", *args, "--format=json"], text=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=45, check=False
        )
        if result.returncode != 0 or len(result.stdout) > 1_000_000:
            return None
        return json.loads(result.stdout)
    except (OSError, subprocess.TimeoutExpired, ValueError):
        return None

def analyze_service(s):
    spec = s.get("spec", {}).get("template", {}).get("spec", {})
    v2 = s.get("template", {})
    account = spec.get("serviceAccountName") or v2.get("serviceAccount")
    containers = spec.get("containers", []) or v2.get("containers", []) or []
    volumes = spec.get("volumes", []) or v2.get("volumes", []) or []
    secret_refs = []
    inline_value_present = False
    expected_env_names = set()
    for container in containers:
        for env in container.get("env", []) or []:
            n = env.get("name")
            if not isinstance(n, str):
                continue
            if n.startswith(("BLAISE_VISUAL_CROSSING_", "BLAISE_VC_")):
                expected_env_names.add(n)
            source = env.get("valueFrom", {}).get("secretKeyRef") or env.get(
                "valueSource", {}
            ).get("secretKeyRef", {})
            if source:
                secret_refs.append(str(source.get("name") or source.get("secret") or ""))
            if n == ENV_KEY and "value" in env:
                inline_value_present = True
    for volume in volumes:
        source = volume.get("secret", {})
        if source:
            secret_refs.append(str(source.get("secretName") or source.get("secret") or ""))
    annotation_text = str(
        (s.get("spec", {}).get("template", {}).get("metadata", {}).get("annotations", {})
         or {}).get("run.googleapis.com/secrets", "")
    )
    if SECRET in annotation_text:
        secret_refs.append(SECRET)
    has_exact_ref = any(
        x == SECRET or x.endswith("/secrets/" + SECRET)
        for x in secret_refs
    )
    return {
        "state": "CLOUD_RUN_CONFIG_READ",
        "backendIdentityMatchesExpected": account
           == "blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com",
        "explicitSecretReferenceIdentified": has_exact_ref,
        "anySecretReferenceCount": len(secret_refs),
        "visualCrossingEnvFlagNameCount": len(expected_env_names),
        "inlineVisualCrossingKeyEnvPresent": inline_value_present,
        "effectiveSecretAccessVerified": False,
        "secretValueRead": False,
        "weatherProviderCalled": False,
        "productionModified": False,
        "subscriberReleaseApproved": False,
    }

def main():
    summary = {
        "state": "CLOUD_RUN_CONFIG_UNAVAILABLE",
        "effectiveSecretAccessVerified": False,
        "secretValueRead": False,
        "weatherProviderCalled": False,
        "productionModified": False,
        "subscriberReleaseApproved": False,
    }
    services = gc("run", "services", "list", "--project=" + PROJECT)
    if isinstance(services, list):
        matches = [s for s in services
                   if isinstance(s, dict)
                   and (s.get("metadata", {}).get("name") or s.get("name", "").split("/")[-1]) == NAME]
        if len(matches) == 1:
            found = matches[0]
            metadata = found.get("metadata", {})
            region = (
                metadata.get("labels", {}).get("cloud.googleapis.com/location")
                or metadata.get("annotations", {}).get("run.googleapis.com/region")
                or found.get("location")
            )
            if isinstance(region, str) and region and "/" not in region:
                detailed = gc(
                    "run", "services", "describe", NAME,
                    "--project=" + PROJECT, "--region=" + region
                )
                if isinstance(detailed, dict):
                    summary = analyze_service(detailed)
                else:
                    summary["state"] = "SERVICE_DESCRIBE_UNAVAILABLE"
            else:
                summary["state"] = "REGION_NOT_IDENTIFIED_NO_GUESS"
        elif not matches:
            summary["state"] = "BACKEND_SERVICE_NOT_FOUND"
        else:
            summary["state"] = "AMBIGUOUS_SERVICE_NAME"
    print("BLAISE_VC_CLOUD_RUN_READONLY=" + json.dumps(
        summary, sort_keys=True, separators=(",", ":")
    ))

if __name__ == "__main__":
    main()
