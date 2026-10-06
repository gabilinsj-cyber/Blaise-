#!/usr/bin/env python3
"""Prepare pinned offline assets; generated binaries never enter the source repository."""
import hashlib
import shutil
import subprocess
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "app/build/generated/dora"
CACHE = ROOT / ".cache/dora"
ARTIFACTS = {
    "sherpa.aar": (
        "https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-1.13.8.aar",
        "633c24321e06b1fe79feafa03ea16cbc0f8a286641e2da3559bac91bdb13bd96",
    ),
    "kokoro.tar.bz2": (
        "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2",
        "c5f7e2d2caf082bc1d20fb70334a61d99d20b484500aad32e7cf84c128ea3298",
    ),
}


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def prepare():
    CACHE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, (url, expected) in ARTIFACTS.items():
        file = CACHE / name
        if not file.is_file() or digest(file) != expected:
            temporary = file.with_suffix(".part")
            subprocess.run(["curl", "--fail", "--location", "--retry", "3", "--max-time", "600", url, "-o", str(temporary)], check=True)
            if digest(temporary) != expected:
                temporary.unlink()
                raise RuntimeError(f"Hash mismatch: {name}")
            temporary.replace(file)
    destination = OUTPUT / "assets/dora"
    marker = destination / "prepared.sha256"
    expected = ARTIFACTS["kokoro.tar.bz2"][1]
    if not marker.is_file() or marker.read_text() != expected:
        shutil.rmtree(destination, ignore_errors=True)
        destination.mkdir(parents=True)
        with tarfile.open(CACHE / "kokoro.tar.bz2", "r:bz2") as archive:
            prefix = "kokoro-multi-lang-v1_0/"
            for member in archive:
                if not member.name.startswith(prefix):
                    continue
                name = member.name[len(prefix):]
                if name not in {"model.onnx", "voices.bin", "tokens.txt", "LICENSE"} and not name.startswith("espeak-ng-data/"):
                    continue
                target = (destination / name).resolve()
                if not target.is_relative_to(destination.resolve()):
                    raise RuntimeError("Unsafe archive entry")
                if member.isfile():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with archive.extractfile(member) as source, target.open("wb") as output:
                        shutil.copyfileobj(source, output)
                elif member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    raise RuntimeError("Links are not accepted in voice assets")
        for required in ("model.onnx", "voices.bin", "tokens.txt", "espeak-ng-data/pt_dict"):
            if not (destination / required).is_file():
                raise RuntimeError(f"Missing asset: {required}")
        # Original package contains 53 speakers; pf_dora is index 42 in the upstream mapping.
        if (destination / "voices.bin").stat().st_size < 43 * 510 * 256 * 4:
            raise RuntimeError("Dora speaker table is incomplete")
        marker.write_text(expected)
    shutil.copyfile(CACHE / "sherpa.aar", OUTPUT / "sherpa-onnx-1.13.8.aar")
    # Native inference tests may leave temporary model files; never package them.
    for temporary in destination.glob(".model.onnx.*"):
        temporary.unlink()
    print("Offline Dora assets verified and prepared")


if __name__ == "__main__":
    prepare()
