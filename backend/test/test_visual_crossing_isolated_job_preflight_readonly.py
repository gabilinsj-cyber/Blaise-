"""Dedicated VC Cloud Run Job readiness checks: offline fixtures only."""
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

script=Path(__file__).resolve().parents[1]/"scripts/visual-crossing-isolated-job-preflight-readonly.py"
spec=importlib.util.spec_from_file_location("vc_isolated_preflight", script)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class IsolatedPreflightTests(unittest.TestCase):
    def test_unprovisioned_or_forbidden_is_inconclusive(self):
        r=mod.summarize(None,None,None)
        self.assertFalse(r["identityDescribeSucceeded"])
        self.assertEqual(r["identityExistenceIfDescribeFailed"],"UNKNOWN")
        self.assertFalse(r["directSecretAccessorBindingFound"])
        self.assertEqual(r["effectiveSecretAccess"],"NOT_VERIFIED")
        self.assertFalse(r["releaseApproved"])

    def test_direct_secret_scoped_role_detected_but_no_access_claim(self):
        identity={"email": mod.ACCOUNT}
        policy={"bindings":[{
          "role":"roles/secretmanager.secretAccessor",
          "members":["serviceAccount:"+mod.ACCOUNT],
          "condition":{"expression":"request.time < timestamp('2030-01-01T00:00:00Z')"}
        }]}
        r=mod.summarize(identity,policy,[])
        self.assertTrue(r["identityDescribeSucceeded"])
        self.assertTrue(r["directSecretAccessorBindingFound"])
        self.assertEqual(r["directSecretAccessorBindingConditionalCount"],1)
        self.assertEqual(r["effectiveSecretAccess"],"NOT_VERIFIED")
        self.assertFalse(r["cloudRunExecutionTriggered"])

    def test_other_identity_grant_not_counted(self):
        p={"bindings":[{"role":"roles/secretmanager.secretAccessor",
           "members":["serviceAccount:blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com"]}]}
        r=mod.summarize({},p,[])
        self.assertFalse(r["directSecretAccessorBindingFound"])
        self.assertEqual(r["cloudRunJobs"],"NO_MATCH_IN_RESULTS")

    def test_existing_job_name_collision_flagged(self):
        r=mod.summarize({},{"bindings":[]},[{"metadata":{"name":mod.JOB}}])
        self.assertEqual(r["cloudRunJobs"],"MATCH_FOUND")

    def test_main_reads_only_three_metadata_endpoints(self):
        commands=[]
        def mock(*args):
            commands.append(args)
            return {} if len(commands)<3 else []
        with patch.object(mod,"read_json",side_effect=mock),patch("builtins.print") as show:
            mod.main()
        self.assertEqual(len(commands),3)
        self.assertEqual(commands[0][:3],("iam","service-accounts","describe"))
        self.assertEqual(commands[1][:2],("secrets","get-iam-policy"))
        self.assertEqual(commands[2][:3],("run","jobs","list"))
        self.assertNotIn("versions access",str(commands))
        self.assertNotIn("secretmanager.versions.access",str(commands))
        self.assertIn("releaseApproved",show.call_args.args[0])

if __name__=="__main__":
    unittest.main(verbosity=2)
