"""Fixture tests; never contacts Google Cloud or a weather provider."""
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

path = Path(__file__).resolve().parents[1] / "scripts/visual-crossing-cloud-run-config-readonly.py"
spec = importlib.util.spec_from_file_location("vc_cloudrun_ro", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class CloudRunReadOnlyTests(unittest.TestCase):
    def test_secret_ref_found_without_printing_values(self):
        service = {"spec":{"template":{"spec":{
            "serviceAccountName":"blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com",
            "containers":[{"env":[
                {"name": "BLAISE_VISUAL_CROSSING_FREE_API_KEY",
                 "valueFrom": {"secretKeyRef": {
                     "name":"blaise-visual-crossing-free-api-key", "key":"latest"}}},
                {"name":"OTHER_PASSWORD","value":"dont-leak-this"}
            ]}]
        }}}}
        res=mod.analyze_service(service)
        self.assertTrue(res["explicitSecretReferenceIdentified"])
        self.assertFalse(res["inlineVisualCrossingKeyEnvPresent"])
        self.assertTrue(res["backendIdentityMatchesExpected"])
        self.assertFalse(res["effectiveSecretAccessVerified"])
        self.assertNotIn("dont-leak-this", str(res))

    def test_inline_key_presence_reports_boolean_not_value(self):
        service={"template":{"serviceAccount":
                    "blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com",
            "containers":[{"env":[{"name":"BLAISE_VISUAL_CROSSING_FREE_API_KEY",
                       "value":"super-private-key"}]}]}}
        res=mod.analyze_service(service)
        self.assertTrue(res["inlineVisualCrossingKeyEnvPresent"])
        self.assertFalse(res["explicitSecretReferenceIdentified"])
        self.assertNotIn("super-private-key",str(res))
        self.assertFalse(res["subscriberReleaseApproved"])

    def test_no_ref_not_claimed_secret_denial(self):
        res=mod.analyze_service({"spec":{"template":{"spec":{
            "serviceAccountName":"blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com",
            "containers":[{"env":[]}]}}}})
        self.assertFalse(res["explicitSecretReferenceIdentified"])
        self.assertFalse(res["effectiveSecretAccessVerified"])

    def test_region_not_guessed(self):
        observed=[]
        def fake_gc(*args):
            observed.append(args)
            return [{"metadata":{"name":"blaise-v6-rj-backend"}}]
        with patch.object(mod, "gc", side_effect=fake_gc), patch("builtins.print") as printer:
            mod.main()
        self.assertEqual(len(observed),1)
        self.assertIn("REGION_NOT_IDENTIFIED_NO_GUESS",printer.call_args.args[0])

if __name__=="__main__":
    unittest.main(verbosity=2)
