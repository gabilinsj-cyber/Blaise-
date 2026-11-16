"""Fail-closed static contract checks before the private Android build.

These only validate source wiring. They never query weather services or
access Google Cloud, and cannot prove active agents or live meteorology.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
read = lambda path: (ROOT / path).read_text(encoding="utf-8")


class FullAdminRegistryTest(unittest.TestCase):
    def test_all_science_methods_mirror_backend_exports(self):
        kernels = read("backend/src/blaise-scientific-kernels.mjs")
        names = re.findall(r"export function\s+(\w+)\s*\(", kernels)
        for group in re.findall(r"export\s*\{(.*?)\}\s*from", kernels, re.S):
            names.extend(x.strip() for x in group.split(",") if x.strip())
        source = read("app/src/main/java/br/com/blaise/rj/BlaiseScientificCatalog.kt")
        android = re.findall(r'BlaiseScientificMethod\("([^"]+)"', source)
        self.assertEqual(len(android), 37)
        self.assertEqual(len(set(android)), 37)
        self.assertEqual(set(android), set(names))

    def test_thirteen_roles_have_truthful_status(self):
        registry = read("app/src/main/java/br/com/blaise/rj/ScientificDashboardPolicy.kt")
        ui = read("app/src/main/java/br/com/blaise/rj/MainActivity.kt")
        self.assertIn("require(allAgents.size == 14)", registry)
        self.assertIn('BlaiseAgentUi(12, "Blaise GeoFusion RJ"', registry)
        self.assertIn('BlaiseAgentUi(13, "Blaise OpenWeather RJ"', registry)
        self.assertIn('BlaiseAgentUi(14, "Blaise Auditor Meteorológico Internacional RJ"', registry)
        self.assertIn("BlaiseAgentDashboard.allAgents.forEach", ui)
        self.assertIn("não comprova que todos estejam executando", ui)
        self.assertIn("AdminScientificCatalogPanel()", ui)
        self.assertNotIn("11 agentes cadastrados", ui)

    def test_variant_packages_and_labels_remain_distinct(self):
        gradle = read("app/build.gradle.kts")
        manifest = read("app/src/main/AndroidManifest.xml")
        self.assertIn('applicationId = "br.com.blaise.rj"', gradle)
        self.assertIn('applicationIdSuffix = ".debug"', gradle)
        self.assertIn('applicationIdSuffix = ".admin"', gradle)
        self.assertIn('manifestPlaceholders["appLabel"] = "Blaise V6 RJ"', gradle)
        self.assertIn('manifestPlaceholders["appLabel"] = "Blaise V6 RJ (Debug)"', gradle)
        self.assertIn('manifestPlaceholders["appLabel"] = "Blaise V6 RJ - Administrador"', gradle)
        self.assertIn('android:label="${appLabel}"', manifest)

    def test_original_layout_and_provenance_still_present(self):
        ui = read("app/src/main/java/br/com/blaise/rj/MainActivity.kt")
        self.assertIn('testTag("reference-three-column-dashboard")', ui)
        self.assertIn('testTag("reference-lower-dashboard")', ui)
        # The city cards now receive licensed international estimates, not
        # Brazilian observations. Keep strict city/source/time provenance and
        # the explicit missing-value fallback.
        self.assertIn("international?.temperatureC", ui)
        self.assertIn('?: "— °C"', ui)
        self.assertIn("Fonte: ${international.source}", ui)
        self.assertIn("international.validAt.atZone(", ui)
        self.assertIn("LocalInternational92.current?.municipality(city.ibgeCode,clock)", ui)


if __name__ == "__main__":
    unittest.main()
