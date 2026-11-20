"""Offline test of non-disclosing IAM inventory for VC Cloud Build image."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

script=Path(__file__).resolve().parents[1]/"scripts/visual-crossing-build-identity-iam-readonly.py"
spec=importlib.util.spec_from_file_location("vc_build_iam",script)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class ReadOnlyBuildIAMTests(unittest.TestCase):
    def test_project_editor_is_reported_as_risk_not_permission_proof(self):
        email="123456789-compute@developer.gserviceaccount.com"
        p={"bindings":[{"role":"roles/editor",
                        "members":["serviceAccount:"+email]},
                       {"role":"roles/artifactregistry.writer",
                        "members":["serviceAccount:other@example.invalid"]}]}
        r=mod.summarize({"serviceAccountEmail":
            "projects/blaise-v6-rj/serviceAccounts/"+email},p,{"bindings":[]})
        self.assertTrue(r["defaultIdentityRecognized"])
        self.assertTrue(r["projectEditorOrOwnerDirect"])
        self.assertFalse(r["projectArtifactWriterDirect"])
        self.assertEqual(r["effectiveArtifactUploadPermission"],"NOT_VERIFIED")
        self.assertNotIn(email,str(r))

    def test_repo_only_writer_and_conditional(self):
        email="123456789-compute@developer.gserviceaccount.com"
        repo={"bindings":[{"role":"roles/artifactregistry.writer",
             "members":["serviceAccount:"+email],
             "condition":{"title":"limited"}}]}
        r=mod.summarize(email,{"bindings":[]},repo)
        self.assertTrue(r["repositoryArtifactWriterDirect"])
        self.assertEqual(r["repositoryConditionalBindingCount"],1)
        self.assertEqual(r["effectiveArtifactUploadPermission"],"NOT_VERIFIED")
        self.assertFalse(r["noIamModified"] is False)

    def test_missing_metadata_is_inconclusive(self):
        r=mod.summarize(None,None,None)
        self.assertFalse(r["defaultIdentityRecognized"])
        self.assertFalse(r["projectPolicyRead"])
        self.assertEqual(r["inheritedAndDenyPolicies"],"NOT_EVALUATED")
        self.assertTrue(r["noBuildSubmitted"])

    def test_no_iam_mutations_or_builds(self):
        commands=[]
        def fake(*args):
            commands.append(args)
            return None
        with patch.object(mod,"read_json",side_effect=fake),patch(
                "builtins.print") as show:
            mod.main()
        self.assertEqual(len(commands),3)
        self.assertEqual(commands[0][:2],("builds","get-default-service-account"))
        self.assertEqual(commands[1][:2],("projects","get-iam-policy"))
        self.assertEqual(commands[2][:3],("artifacts","repositories","get-iam-policy"))
        self.assertNotIn("submit",str(commands))
        self.assertNotIn("add-iam-policy-binding",str(commands))
        self.assertIn("NOT_VERIFIED",show.call_args.args[0])


if __name__=="__main__":
    unittest.main(verbosity=2)
