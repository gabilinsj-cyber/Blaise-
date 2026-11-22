"""Secret Manager historical-log inspection: zero Google Cloud calls in tests."""
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

file = (Path(__file__).resolve().parents[1] /
        "scripts/visual-crossing-access-history-readonly.py")
spec = importlib.util.spec_from_file_location("vc_history_ro", file)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class EvidenceOnlyTests(unittest.TestCase):
    def test_prior_success_not_current_access_verdict(self):
        entries = [{"timestamp": "2026-11-19T19:00:00Z",
                    "protoPayload": {
                        "serviceName": "secretmanager.googleapis.com",
                        "methodName": "google.cloud.secretmanager.v1.SecretManagerService.AccessSecretVersion",
                        "resourceName": "projects/111/secrets/" + mod.SECRET + "/versions/1",
                        "authenticationInfo": {"principalEmail": mod.PRINCIPAL},
                        "status": {},
                        "SECRET_VALUE": "NEVER_PRINT_THIS"
                    }}]
        r = mod.summarize({"state": "ENABLED"}, entries)
        self.assertEqual(r["secretVersionOneState"], "ENABLED")
        self.assertEqual(r["historicalSuccessfulAccessCountInReturnedWindow"], 1)
        self.assertEqual(r["effectiveAccessNow"], "NOT_VERIFIED")
        self.assertFalse(r["secretVersionPayloadRead"])
        self.assertFalse(r["releaseApproved"])
        self.assertNotIn("NEVER_PRINT_THIS", str(r))

    def test_other_account_and_error_status_ignored(self):
        common = {
            "methodName": "AccessSecretVersion",
            "resourceName": "projects/111/secrets/" + mod.SECRET + "/versions/1",
        }
        logs = [
            {"timestamp": "2026-11-19T18:00:00Z", "protoPayload": {
                **common, "authenticationInfo": {"principalEmail": "someone@example.invalid"}}},
            {"timestamp": "2026-11-19T18:05:00Z", "protoPayload": {
                **common, "authenticationInfo": {"principalEmail": mod.PRINCIPAL},
                "status": {"code": 7}}},
            {"timestamp": "2026-11-19T18:06:00Z", "protoPayload": {
                **common, "resourceName": "projects/111/secrets/OTHER/versions/1",
                "authenticationInfo": {"principalEmail": mod.PRINCIPAL}}},
        ]
        r = mod.summarize({"state": "ENABLED"}, logs)
        self.assertEqual(r["historicalSuccessfulAccessCountInReturnedWindow"], 0)
        self.assertTrue(r["zeroLogsDoesNotProveDenial"])

    def test_missing_data_access_logs_is_inconclusive(self):
        r = mod.summarize(None, None)
        self.assertEqual(r["secretVersionOneState"], "NOT_VERIFIED")
        self.assertEqual(r["auditLoggingQuery"], "UNAVAILABLE")
        self.assertEqual(r["effectiveAccessNow"], "NOT_VERIFIED")

    def test_main_calls_only_metadata_and_logging(self):
        captured = []
        def fake(*args):
            captured.append(args)
            return {"state": "ENABLED"} if args[0] == "secrets" else []
        with patch.object(mod, "read_json", side_effect=fake), patch(
                "builtins.print") as emitted:
            mod.main()
        self.assertEqual(len(captured), 2)
        self.assertEqual(captured[0][:3], (
            "secrets", "versions", "describe"
        ))
        self.assertEqual(captured[1][:2], ("logging", "read"))
        self.assertNotIn("versions.access", str(captured))
        self.assertIn("NOT_VERIFIED", emitted.call_args.args[0])


if __name__ == "__main__":
    unittest.main(verbosity=2)
