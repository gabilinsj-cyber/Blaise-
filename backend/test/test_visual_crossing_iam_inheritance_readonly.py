"""Offline regression for the read-only IAM inheritance analyzer."""
import importlib.util
from pathlib import Path
import unittest

file = (Path(__file__).resolve().parents[1] /
        "scripts/visual-crossing-iam-inheritance-readonly.py")
spec = importlib.util.spec_from_file_location("vc_iam_readonly", file)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

BACKEND = audit.ACCOUNTS[0]
NOAA = audit.ACCOUNTS[1]


class PolicyAnalyzerTests(unittest.TestCase):
    def test_inherited_binding_is_visible_and_not_mistaken_for_direct(self):
        entries = [
            {"type": "project", "policy": {"bindings": []}},
            {"type": "organization", "policy": {"bindings": [
                {"role": "roles/secretmanager.secretAccessor",
                 "members": ["serviceAccount:" + BACKEND]}
            ]}},
        ]
        r = audit.analyze(entries, {"bindings": []})
        self.assertEqual(
            r["serviceAccountExplicitAllowBindings"][BACKEND],
            [{"scope": "organization",
              "role": "roles/secretmanager.secretAccessor",
              "conditional": False}],
        )
        self.assertEqual(
            r["serviceAccountExplicitAllowBindings"][NOAA], []
        )

    def test_group_public_conditions_and_deny_are_flagged(self):
        entries = [
            {"type": "folder", "policy": {"bindings": [
                {"role": "roles/editor",
                 "members": ["group:internal-team@company.test"]},
                {"role": "roles/viewer",
                 "members": ["allAuthenticatedUsers"],
                 "condition": {"expression": "request.time < timestamp('2030-01-01T00:00:00Z')"}},
            ]}},
            {"type": "organization", "policy": {
                "kind": "DenyPolicy",
                "rules": [{"denyRule": {"deniedPermissions": [
                    "secretmanager.googleapis.com/versions.access"
                ]}}],
            }},
        ]
        r = audit.analyze(entries, {"bindings": []})
        self.assertEqual(r["denyPolicyObjectsSeen"], 1)
        self.assertEqual(r["iamConditionsCount"], 1)
        self.assertEqual(len(r["broadAllowBindings"]), 1)
        self.assertEqual(len(r["dynamicOrGroupBindings"]), 1)
        self.assertNotIn(
            "internal-team@company.test", str(r)
        )

    def test_secret_grant_and_custom_role_not_dropped(self):
        r = audit.analyze([], {"bindings": [
            {"role": "projects/blaise-v6-rj/roles/custom",
             "members": ["serviceAccount:" + NOAA]}
        ]})
        self.assertEqual(
            r["serviceAccountExplicitAllowBindings"][NOAA][0]["scope"],
            "secret"
        )
        self.assertEqual(
            r["serviceAccountExplicitAllowBindings"][NOAA][0]["role"],
            "projects/blaise-v6-rj/roles/custom"
        )

    def test_unknown_policy_is_not_a_security_pass(self):
        r = audit.analyze([{"type": "project", "policy": None}],
                          {"bindings": []})
        self.assertEqual(r["unrecognizedPolicyItemsCount"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
