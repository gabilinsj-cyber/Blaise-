"""Offline allowlist tests for VC proof build staging (no Google Cloud calls)."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

script = Path(__file__).resolve().parents[1] / "scripts/visual-crossing-proof-image-prepare.py"
spec = importlib.util.spec_from_file_location("vc_image_prep", script)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def fixtures():
    backend = Path(__file__).resolve().parents[1]
    return {dest: (backend.parent / src).read_bytes()
            for dest, src in mod.SOURCE_MAP.items()}


class SafeImageBuildPrepTests(unittest.TestCase):
    def test_expected_three_file_source_only(self):
        files = fixtures()
        self.assertEqual(len(files), 3)
        self.assertTrue(mod.validate_context(files))
        self.assertEqual(sorted(files), [
            "Dockerfile",
            "scripts/visual-crossing-runtime-secret-proof.mjs",
            "src/rj-visual-crossing-runtime-secret-proof.mjs",
        ])

    def test_staging_is_idempotent_and_never_builds_or_uploads(self):
        with tempfile.TemporaryDirectory() as tmp:
            files = fixtures()
            a = mod.stage(files, "a" * 40, tmp)
            b = mod.stage(files, "a" * 40, tmp)
            self.assertEqual(a["state"], "PREPARED_ONLY")
            self.assertEqual(b["state"], "UNCHANGED_EXISTING_CONTEXT")
            self.assertEqual(a["fileCount"], 3)
            for field in ("cloudBuildSubmitted", "artifactUploaded",
                          "cloudRunJobCreated", "cloudRunJobExecuted",
                          "iamChanged", "secretRead", "releaseApproved"):
                self.assertFalse(a[field])
            folder = Path(a["contextPath"])
            self.assertEqual({p.relative_to(folder).as_posix()
                              for p in folder.rglob("*") if p.is_file()},
                             set(files))
            self.assertEqual(
                a["proposedImageUri"],
                "southamerica-east1-docker.pkg.dev/blaise-v6-rj/"
                "blaise-vc-proof/vc-secret-proof:git-aaaaaaaaaaaa",
            )

    def test_disallow_extra_file_and_unsafe_dockerfile(self):
        files = fixtures()
        with self.assertRaises(mod.PreparationBlocked):
            mod.validate_context({**files, ".env": b"PRIVATE_KEY=123"})
        with self.assertRaises(mod.PreparationBlocked):
            mod.validate_context({**files, "Dockerfile": b"FROM node:latest\nCOPY . /app\n"})
        with self.assertRaises(mod.PreparationBlocked):
            mod.validate_context({**files, "Dockerfile": b"FROM scratch\n"})

    def test_existing_context_unexpected_file_blocks(self):
        with tempfile.TemporaryDirectory() as tmp:
            files = fixtures()
            report = mod.stage(files, "b" * 40, tmp)
            (Path(report["contextPath"]) / "keys.txt").write_text("unrelated")
            with self.assertRaises(mod.PreparationBlocked) as e:
                mod.stage(files, "b" * 40, tmp)
            self.assertIn("UNEXPECTED_FILES", str(e.exception))

    def test_existing_context_changed_file_blocks_without_overwriting(self):
        with tempfile.TemporaryDirectory() as tmp:
            files = fixtures()
            report = mod.stage(files, "c" * 40, tmp)
            p = Path(report["contextPath"]) / "Dockerfile"
            p.write_text("modified by someone else")
            with self.assertRaises(mod.PreparationBlocked):
                mod.stage(files, "c" * 40, tmp)
            self.assertEqual(p.read_text(), "modified by someone else")

    def test_invalid_revision_blocks(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(mod.PreparationBlocked):
                mod.stage(fixtures(), "FETCH_HEAD", tmp)


if __name__ == "__main__":
    unittest.main(verbosity=2)
