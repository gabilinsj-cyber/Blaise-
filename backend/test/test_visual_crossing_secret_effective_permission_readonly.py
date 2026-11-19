"""Offline unit tests, never calls Google Cloud APIs or contacts a provider."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

file = (Path(__file__).resolve().parents[1] /
        "scripts/visual-crossing-secret-effective-permission-readonly.py")
spec = importlib.util.spec_from_file_location("vc_secret_iam_advice", file)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class AdvisorySecretAccessTests(unittest.TestCase):
    def test_exact_permission_reported_is_not_release_authorization(self):
        r = mod.evaluate_permissions({"permissions": [mod.PERMISSION]})
        self.assertEqual(r["state"], "PERMISSION_REPORTED_BY_API")
        self.assertFalse(r["releaseApproved"])
        self.assertTrue(r["testIamPermissionsIsAdvisory"])
        self.assertFalse(r["secretValueRead"])

    def test_no_permission_is_not_conclusive_denial(self):
        r = mod.evaluate_permissions({"permissions": []})
        self.assertEqual(r["state"], "PERMISSION_NOT_REPORTED")
        self.assertIn("NOT_A_CONCLUSIVE_DENIAL", r["caveat"])

    def test_unknown_fields_cannot_be_interpreted_as_allowed(self):
        for bad in (None, [], {"permissions": "granted"},
                    {"permissions": [True, 3]}, {"permissions": None}):
            self.assertEqual(
                mod.evaluate_permissions(bad)["state"],
                "INVALID_PERMISSION_RESPONSE",
            )

    def test_impersonation_blocked_leaves_iam_undetermined(self):
        class FakeProcess:
            returncode = 1
            stdout = ""
            stderr = "403 with internal detail that must not be shown"
        with patch.object(mod.subprocess, "run", return_value=FakeProcess()):
            result = mod.run_probe()
        self.assertEqual(
            result["state"], "SERVICE_ACCOUNT_IMPERSONATION_UNAVAILABLE"
        )
        self.assertFalse(result["releaseApproved"])
        self.assertNotIn("internal detail", str(result))


if __name__ == "__main__":
    unittest.main(verbosity=2)
