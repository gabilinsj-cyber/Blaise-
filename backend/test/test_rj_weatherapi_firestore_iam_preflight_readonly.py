"""Completely offline tests: no gcloud, secret, Firestore or provider request."""
import contextlib
import importlib.util
from io import StringIO
from pathlib import Path
import unittest
from unittest.mock import patch
import json

path = (Path(__file__).resolve().parents[1] / "scripts" /
        "rj-weatherapi-firestore-iam-preflight-readonly.py")
spec = importlib.util.spec_from_file_location("rj_wa_iam_preflight", path)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class PurePolicyTests(unittest.TestCase):
    def test_inherited_grant_is_visible_but_not_effective_permission(self):
        entries = [
            {"type": "project", "policy": {"bindings": []}},
            {"type": "folder", "policy": {"bindings": [
                {"role": "roles/datastore.user",
                 "members": ["serviceAccount:" + audit.ACCOUNT]}
            ]}}
        ]
        result = audit.classify_bindings(entries)
        self.assertEqual(result["roles"], [
            {"scope": "folder", "role": "roles/datastore.user",
             "conditional": False}
        ])
        interpretation = audit.interpret_roles(result)
        self.assertEqual(len(
            interpretation["directOrInheritedDatastoreRoleBindings"]), 1)
        self.assertFalse(interpretation["permissionGrantedConcluded"])
        self.assertFalse(interpretation["permissionDeniedConcluded"])

    def test_editor_and_custom_are_not_silently_ignored(self):
        entries = [{"type": "project", "policy": {"bindings": [
            {"role": "roles/editor",
             "members": ["serviceAccount:" + audit.ACCOUNT]},
            {"role": "projects/blaise-v6-rj/roles/limitedFirestore",
             "members": ["serviceAccount:" + audit.ACCOUNT]}
        ]}}]
        parsed = audit.interpret_roles(audit.classify_bindings(entries))
        self.assertEqual(len(parsed["potentiallyBroaderRoleBindings"]), 1)
        self.assertEqual(len(parsed["customRoleBindingsRequireInspection"]), 1)
        self.assertEqual(parsed["directOrInheritedDatastoreRoleBindings"], [])
        self.assertFalse(parsed["permissionGrantedConcluded"])

    def test_group_member_conditions_public_and_deny_are_unresolved(self):
        rows = [
            {"type": "organization", "policy": {"bindings": [
                {"role": "roles/datastore.user",
                 "members": ["group:private-team@example.invalid"]},
                {"role": "roles/viewer", "members": ["allUsers"],
                 "condition": {"expression": "unknown"}}
            ]}},
            {"type": "folder", "policy": {"kind": "DenyPolicy"}}
        ]
        x = audit.classify_bindings(rows)
        self.assertTrue(x["rolesMayBeIncomplete"])
        self.assertEqual(x["groupOrDynamicBindingCount"], 1)
        self.assertEqual(x["broadBindingCount"], 1)
        self.assertEqual(x["conditionalRoleCount"], 1)
        self.assertEqual(x["denyPolicyObjectsSeen"], 1)
        self.assertNotIn("private-team@example.invalid", str(x))

    def test_empty_roles_are_not_denial_and_unknown_policy_not_approval(self):
        empty = audit.interpret_roles(audit.classify_bindings([
            {"type": "project", "policy": {"bindings": []}}
        ]))
        self.assertFalse(empty["permissionDeniedConcluded"])
        self.assertFalse(empty["permissionGrantedConcluded"])
        invalid = audit.classify_bindings([{"type": "project", "policy": None}])
        self.assertTrue(invalid["rolesMayBeIncomplete"])


class OfflineInvocationTests(unittest.TestCase):
    def test_main_only_uses_read_only_cloud_metadata_commands(self):
        calls = []
        def fake_read(*args):
            calls.append(args)
            if args[:2] == ("projects", "get-ancestors-iam-policy"):
                return ([{"type": "project", "policy": {"bindings": []}}], None)
            if args[:2] == ("secrets", "get-iam-policy"):
                return ({"bindings": [{"role": "roles/secretmanager.secretAccessor",
                         "members": ["serviceAccount:" + audit.ACCOUNT]}]}, None)
            if args[:3] == ("secrets", "versions", "describe"):
                return ({"state": "ENABLED"}, None)
            if args[:3] == ("firestore", "databases", "describe"):
                return ({"name": "projects/blaise-v6-rj/databases/(default)",
                         "type": "FIRESTORE_NATIVE"}, None)
            raise AssertionError("unexpected command")
        with patch.object(audit, "read_metadata", side_effect=fake_read):
            buffer = StringIO()
            with contextlib.redirect_stdout(buffer):
                status = audit.main()
        self.assertEqual(status, 0)
        report = json.loads(buffer.getvalue().split("=", 1)[1])
        self.assertTrue(report["weatherApiSecretAccessorDirect"])
        self.assertEqual(report["weatherApiSecretV2State"], "ENABLED")
        self.assertEqual(report["firestoreEffectiveAccess"],
                         "NOT_PROVEN_BY_IAM_POLICY_LISTING")
        self.assertFalse(report["secretValueRead"])
        self.assertFalse(report["firestoreDocumentsRead"])
        self.assertFalse(report["productionChanged"])
        self.assertFalse(report["clientDataReleased"])
        self.assertEqual(report["providerCalls"], 0)
        self.assertEqual(report["creditReservations"], 0)
        serialized = str(calls).lower()
        for unsafe in ("versions', 'access", "add-iam-policy-binding",
                       "set-iam-policy", "run', 'deploy", "documents', 'get"):
            self.assertNotIn(unsafe, serialized)

    def test_failure_downgrades_inheritance_evidence_not_premature_allow(self):
        def fake_read(*args):
            if args[:2] == ("projects", "get-ancestors-iam-policy"):
                return None, "POLICY_OR_METADATA_UNAVAILABLE"
            if args[:2] == ("projects", "get-iam-policy"):
                return {"bindings": []}, None
            return None, "POLICY_OR_METADATA_UNAVAILABLE"
        with patch.object(audit, "read_metadata", side_effect=fake_read):
            buffer = StringIO()
            with contextlib.redirect_stdout(buffer):
                status = audit.main()
        report = json.loads(buffer.getvalue().split("=", 1)[1])
        self.assertEqual(status, 2)
        self.assertEqual(report["policyCoverage"], "PROJECT_ONLY")
        self.assertIn("INHERITED_POLICIES_NOT_FULLY_VERIFIED", report["issues"])
        self.assertFalse(report["permissionGrantedConcluded"])
        self.assertFalse(report["permissionDeniedConcluded"])


if __name__ == "__main__":
    unittest.main()
