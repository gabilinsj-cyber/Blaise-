"""Cloud Build readiness: offline fixtures, no actual Google Cloud calls."""
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

script = Path(__file__).resolve().parents[1] / "scripts/visual-crossing-image-build-preflight-readonly.py"
spec = importlib.util.spec_from_file_location("vc_build_ro", script)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class SafeBuildPreflightTests(unittest.TestCase):
    def test_normal_preflight_does_not_assert_cost_or_permissions(self):
        services = [{"config": {"name": "cloudbuild.googleapis.com"}},
                    {"config": {"name": "artifactregistry.googleapis.com"}}]
        r = mod.summarize(
            services, {"billingEnabled": True},
            {"serviceAccount": "123456789-compute@developer.gserviceaccount.com"},
            {"name": "projects/x/locations/southamerica-east1/repositories/blaise-vc-proof",
             "format": "DOCKER"},
            {"bindings": []},
        )
        self.assertEqual(r["cloudBuildApi"], "ENABLED")
        self.assertEqual(r["artifactRegistryApi"], "ENABLED")
        self.assertEqual(r["defaultBuildIdentityType"], "COMPUTE_ENGINE_DEFAULT")
        self.assertTrue(r["targetRepositoryConfirmed"])
        self.assertEqual(r["remainingFreeBuildMinutes"], "NOT_VERIFIED")
        self.assertEqual(r["effectiveArtifactUploadPermission"], "NOT_VERIFIED")
        self.assertTrue(r["billingMayApply"])
        self.assertTrue(r["buildNotSubmitted"])

    def test_missing_data_never_assumes_green(self):
        r = mod.summarize(None, None, None, None, None)
        self.assertEqual(r["cloudBuildApi"], "UNKNOWN")
        self.assertEqual(r["billing"], "UNKNOWN")
        self.assertEqual(r["defaultBuildIdentityType"], "UNAVAILABLE")
        self.assertFalse(r["targetRepositoryConfirmed"])
        self.assertEqual(r["effectiveArtifactUploadPermission"], "NOT_VERIFIED")

    def test_legacy_builder_and_missing_services(self):
        r = mod.summarize([], {"billingEnabled": False},
                          {"serviceAccount": "123@cloudbuild.gserviceaccount.com"},
                          {"name": "projects/x/repositories/other", "format": "DOCKER"}, {})
        self.assertEqual(r["defaultBuildIdentityType"], "CLOUD_BUILD_LEGACY")
        self.assertEqual(r["cloudBuildApi"], "NOT_FOUND_IN_ENABLED_LIST")
        self.assertEqual(r["billing"], "DISABLED")
        self.assertFalse(r["targetRepositoryConfirmed"])


    def test_google_documented_service_account_email_resource_field(self):
        google_shape = {
            "name": "projects/blaise-v6-rj/locations/southamerica-east1/defaultServiceAccount",
            "serviceAccountEmail": (
                "projects/blaise-v6-rj/serviceAccounts/"
                "123456789-compute@developer.gserviceaccount.com"
            ),
        }
        self.assertEqual(mod.classify_default_identity(google_shape),
                         "COMPUTE_ENGINE_DEFAULT")
        google_shape["serviceAccountEmail"] = (
            "projects/blaise-v6-rj/serviceAccounts/"
            "123456789@cloudbuild.gserviceaccount.com"
        )
        self.assertEqual(mod.classify_default_identity(google_shape),
                         "CLOUD_BUILD_LEGACY")
        google_shape["serviceAccountEmail"] = (
            "projects/blaise-v6-rj/serviceAccounts/"
            "private-build@blaise-v6-rj.iam.gserviceaccount.com"
        )
        self.assertEqual(mod.classify_default_identity(google_shape),
                         "USER_MANAGED_OR_CUSTOM")
        self.assertNotIn("private-build@", str(mod.summarize(
            [], {}, google_shape, {}, {}
        )))

    def test_main_calls_only_safe_read_methods(self):
        queries = []
        def fake(*args):
            queries.append(args)
            return None
        with patch.object(mod, "run_json", side_effect=fake), patch(
                "builtins.print") as printer:
            mod.main()
        self.assertEqual(len(queries), 5)
        self.assertEqual(queries[0][:2], ("services", "list"))
        self.assertEqual(queries[1][:2], ("billing", "projects"))
        self.assertEqual(queries[2][:2], ("builds", "get-default-service-account"))
        self.assertEqual(queries[3][:3], ("artifacts", "repositories", "describe"))
        self.assertEqual(queries[4][:3], ("artifacts", "repositories", "get-iam-policy"))
        self.assertNotIn("submit", str(queries))
        self.assertNotIn("add-iam-policy-binding", str(queries))
        self.assertIn("buildNotSubmitted", printer.call_args.args[0])


if __name__ == "__main__":
    unittest.main(verbosity=2)
