"""Agent 14 source policy and non-operational registration contract."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
get=lambda p:(ROOT/p).read_text(encoding='utf-8')

POLICY=get("backend/src/rj-international-source-policy.mjs")
AGENT=get("backend/src/rj-agent14-meteorological-auditor.mjs")
REGISTRY=get("app/src/main/java/br/com/blaise/rj/ScientificDashboardPolicy.kt")
UI=get("app/src/main/java/br/com/blaise/rj/MainActivity.kt")
ANDROID=get("app/src/main/java/br/com/blaise/rj/data/RjInternationalWeatherPolicy.kt")
DOC=get("docs/BLAISE_V6_RJ_MASTER_SPEC_20261116.md")

class Agent14NonOperationalContractTest(unittest.TestCase):
    def test_inmet_defesa_civil_review_only_without_alerta_rio(self):
        self.assertIn("'INMET', 'DEFESA_CIVIL_RJ'",POLICY)
        self.assertNotIn("'INMET', 'ALERTA_RIO', 'DEFESA_CIVIL_RJ'",POLICY)
        self.assertIn('"INMET", "Defesa Civil RJ"',ANDROID)
        self.assertNotIn('"INMET", "Alerta Rio", "Defesa Civil RJ"',ANDROID)

    def test_original_13_agents_preserved_and_agent14_not_claimed_online(self):
        self.assertIn("require(elevenAgents.size == 11)",REGISTRY)
        self.assertIn("require(allAgents.size == 14)",REGISTRY)
        self.assertIn("BlaiseAgentUi(13, \"Blaise OpenWeather RJ\"",REGISTRY)
        self.assertIn("BlaiseAgentUi(14, \"Blaise Auditor Meteorológico Internacional RJ\"",REGISTRY)
        self.assertIn("14 agentes especificados; o cadastro não comprova",UI)
        self.assertIn("enabledInProduction: false",AGENT)
        self.assertIn("mayQueryAI: false",AGENT)
        self.assertIn("mayFetchInmet: false",AGENT)

    def test_gpt_lead_is_not_a_sensor_and_inmet_partners_not_a_reference(self):
        self.assertIn("REVIEW_URL_ONLY",AGENT)
        self.assertIn("NOT_INMET_PRIMARY_SOURCE",AGENT)
        self.assertIn("record.stationOwner !== 'INMET'",AGENT)
        self.assertIn("record.containsPartnerData === true",AGENT)
        self.assertIn("record.aiGenerated === true",AGENT)
        self.assertIn("comparisonUseLicensed",AGENT)
        self.assertIn("GPT",DOC)

    def test_continuity_without_fake_live_temperature(self):
        self.assertIn("HISTORICAL_NOT_CURRENT",AGENT)
        self.assertIn("CURRENT_DATA_NOT_CONFIRMED",AGENT)
        self.assertIn("chooseFromThreeInternationalSources",AGENT)
        self.assertIn("publicSafetyLinksUnaffected: true",AGENT)

if __name__=="__main__":
    unittest.main()
