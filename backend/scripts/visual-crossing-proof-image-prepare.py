#!/usr/bin/env python3
"""Prepare an allowlisted Visual Crossing proof Docker build context OFFLINE.

MUST be run in the detached RJ audit worktree after a fresh 'git fetch' of the
approved PR branch. This stages only three reviewed files from FETCH_HEAD,
never the entire app or Cloud Shell home. It never invokes Docker/gcloud,
reads Secret Manager, builds an image, grants roles, or changes production.

The published image must only be built separately, after cost, API, build
identity and repository permissions are reviewed.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

PROJECT = "blaise-v6-rj"
REGION = "southamerica-east1"
REPOSITORY = "blaise-vc-proof"
IMAGE = "vc-secret-proof"

SOURCE_MAP = {
    "Dockerfile": "backend/Dockerfile.visual-crossing-secret-proof",
    "src/rj-visual-crossing-runtime-secret-proof.mjs":
        "backend/src/rj-visual-crossing-runtime-secret-proof.mjs",
    "scripts/visual-crossing-runtime-secret-proof.mjs":
        "backend/scripts/visual-crossing-runtime-secret-proof.mjs",
}


class PreparationBlocked(RuntimeError):
    pass


def validate_context(files):
    if set(files) != set(SOURCE_MAP):
        raise PreparationBlocked("SOURCE_FILE_ALLOWLIST_MISMATCH")
    for dest, value in files.items():
        if not isinstance(value, bytes) or len(value) < 1 or len(value) > 100_000:
            raise PreparationBlocked("INVALID_OR_TOO_LARGE_SOURCE")
        if b"\x00" in value:
            raise PreparationBlocked("BINARY_SOURCE_NOT_ALLOWED")
    d = files["Dockerfile"].decode("utf-8")
    if not re.search(r"^FROM node:24-bookworm-slim@sha256:[0-9a-f]{64}$", d, re.M):
        raise PreparationBlocked("UNPINNED_BASE_IMAGE")
    required = [
        "COPY --chown=node:node src/rj-visual-crossing-runtime-secret-proof.mjs",
        "COPY --chown=node:node scripts/visual-crossing-runtime-secret-proof.mjs",
        'CMD ["node", "scripts/visual-crossing-runtime-secret-proof.mjs"]',
        "USER node",
    ]
    if any(piece not in d for piece in required):
        raise PreparationBlocked("UNEXPECTED_DOCKERFILE")
    for line in d.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        command = stripped.split()[0].upper()
        if command not in {"FROM", "WORKDIR", "COPY", "USER", "ENV", "CMD"}:
            raise PreparationBlocked("DISALLOWED_DOCKER_INSTRUCTION")
        if command == "COPY" and (
            stripped.count("COPY") != 1 or
            " --from=" in stripped or
            " . " in stripped or
            stripped.endswith(" .")
        ):
            raise PreparationBlocked("UNEXPECTED_DOCKER_COPY")
    if "src/runtime.mjs" in d or "BLAISE_VISUAL_CROSSING_FREE_API_KEY=" in d:
        raise PreparationBlocked("SUBSCRIBER_OR_INLINE_KEY_NOT_ALLOWED")
    return True


def stage(files, revision, home):
    if not re.fullmatch(r"[0-9a-f]{40,64}", revision):
        raise PreparationBlocked("INVALID_GIT_REVISION")
    validate_context(files)
    directory = Path(home) / ("blaise-vc-proof-build-" + revision[:12])
    if directory.is_symlink():
        raise PreparationBlocked("SYMLINK_CONTEXT_NOT_ALLOWED")
    if directory.exists():
        actual = set()
        for p in directory.rglob("*"):
            if p.is_symlink():
                raise PreparationBlocked("SYMLINK_CONTEXT_NOT_ALLOWED")
            if p.is_file():
                actual.add(p.relative_to(directory).as_posix())
        if actual != set(files):
            raise PreparationBlocked("EXISTING_CONTEXT_HAS_UNEXPECTED_FILES")
        for name, value in files.items():
            if (directory / name).read_bytes() != value:
                raise PreparationBlocked("EXISTING_CONTEXT_CONTENT_MISMATCH")
        state = "UNCHANGED_EXISTING_CONTEXT"
    else:
        directory.mkdir(mode=0o700)
        for name, value in sorted(files.items()):
            path = directory / name
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with path.open("xb") as fp:
                fp.write(value)
            path.chmod(0o600)
        state = "PREPARED_ONLY"
    image_uri = (
        f"{REGION}-docker.pkg.dev/{PROJECT}/{REPOSITORY}/"
        f"{IMAGE}:git-{revision[:12]}"
    )
    return {
        "state": state,
        "sourceCommit": revision,
        "contextPath": str(directory),
        "fileNames": sorted(files),
        "fileCount": len(files),
        "sourceBytes": sum(len(v) for v in files.values()),
        "fileSHA256": {name: hashlib.sha256(value).hexdigest()
                       for name, value in sorted(files.items())},
        "proposedImageUri": image_uri,
        "secretRead": False,
        "cloudBuildSubmitted": False,
        "artifactUploaded": False,
        "cloudRunJobCreated": False,
        "cloudRunJobExecuted": False,
        "iamChanged": False,
        "keyExposedInImage": False,
        "releaseApproved": False,
    }


def git_capture(cwd, *args):
    try:
        out = subprocess.run(["git", "-C", str(cwd), *args],
                             stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE,
                             check=False, timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        raise PreparationBlocked("GIT_SOURCE_UNAVAILABLE") from None
    if out.returncode or len(out.stdout) > 200_000:
        raise PreparationBlocked("GIT_SOURCE_UNAVAILABLE")
    return out.stdout


def prepare(cwd, home):
    revision = git_capture(cwd, "rev-parse", "--verify", "FETCH_HEAD^{commit}"
                           ).decode("ascii").strip()
    if not re.fullmatch(r"[0-9a-f]{40,64}", revision):
        raise PreparationBlocked("INVALID_GIT_REVISION")
    files = {
        dest: git_capture(cwd, "show", f"{revision}:{source}")
        for dest, source in SOURCE_MAP.items()
    }
    return stage(files, revision, home)


if __name__ == "__main__":
    try:
        report = prepare(Path.cwd(), Path.home())
    except PreparationBlocked as exc:
        report = {"state": "BLOCKED", "reason": str(exc),
                  "cloudBuildSubmitted": False,
                  "artifactUploaded": False,
                  "cloudRunJobCreated": False}
    print("BLAISE_VC_BUILD_PREP=" +
          json.dumps(report, sort_keys=True, separators=(",", ":")))
