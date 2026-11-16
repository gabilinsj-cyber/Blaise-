"""No network, no Cloud Build: guard official warning and weather separation."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
read=lambda path:(ROOT/path).read_text(encoding="utf-8")
UI = read("app/src/main/java/br/com/blaise/rj/MainActivity.kt")
GRADLE = read("app/build.gradle.kts")
W = read("app/src/main/java/br/com/blaise/rj/data/OfficialWeatherClient.kt")
A = read("app/src/main/java/br/com/blaise/rj/data/RjPublicOfficialAlertOnly.kt")
POLICY = read("backend/src/rj-international-source-policy.mjs")

class PublicSafetyAlertIsolationTest(unittest.TestCase):
    def test_brazilian_station_measurements_are_still_disabled(self):
        self.assertGreaterEqual(W.count("!RjInternationalWeatherPolicy.ALLOW_BRAZILIAN_OBSERVATIONS_IN_APK"),6)
        self.assertIn("BRAZILIAN_METEOROLOGY_REVIEW_ONLY",W)
        self.assertIn("INTERNATIONAL_OBSERVATION_UNAVAILABLE",
            read("app/src/main/java/br/com/blaise/rj/data/RjInternationalWeatherPolicy.kt"))

    def test_inmet_alert_feed_requires_explicit_legal_release(self):
        self.assertIn('System.getenv("BLAISE_RJ_PUBLIC_ALERT_RELAY_AUTHORIZED")',GRADLE)
        self.assertIn('buildConfigField("boolean", "BLAISE_RJ_PUBLIC_ALERT_RELAY_AUTHORIZED"',GRADLE)
        self.assertIn('if (BuildConfig.BLAISE_RJ_PUBLIC_ALERT_RELAY_AUTHORIZED)',UI)
        self.assertIn(".sanitize(fetched.snapshot, Instant.now())",UI)
        self.assertIn('row.copy(risk = null, warningIds =',A)
        self.assertIn('marine = null',A)
        self.assertIn('sourceProducts = snapshot.sourceProducts.filter { it.id == "inmet" }',A)
        self.assertIn('warningInventories = snapshot.warningInventories.filter { it.sourceId == "inmet" }',A)
        self.assertIn('it.sourceUrl == INMET_ALERT_ORIGIN && it.current(now)',A)

    def test_all_four_official_alert_links_are_explicit_and_not_implied_live(self):
        for issuer in ['INMET','Sistema Alerta Rio','COR.Rio','Defesa Civil RJ']:
            self.assertIn(issuer,A)
        self.assertIn('https://avisos.inmet.gov.br/',A)
        self.assertIn('https://www.sistema-alerta-rio.com.br/alertas/',A)
        self.assertIn('https://cor.rio/',A)
        self.assertIn('https://defesacivil.rj.gov.br/',A)
        self.assertIn('OfficialSafetySourcesPanel()',UI)
        self.assertIn('Links não comprovam alerta ativo.',UI)

    def test_independent_international_secondary_source_only(self):
        self.assertIn('arbitrateWithSecondInternationalSource',POLICY)
        self.assertIn('comparisonPermissionConfirmed',POLICY)
        self.assertIn("current.sourceId === alternative.sourceId",POLICY)
        self.assertIn('alternative.qualityScore <= current.qualityScore',POLICY)
        self.assertIn("REPLACE_WITH_SECOND_INTERNATIONAL",POLICY)
        self.assertIn('independentProviderEvidence',POLICY)
        self.assertIn('if (displayedAs !== type) return false',POLICY)

if __name__ == '__main__':
    unittest.main()
