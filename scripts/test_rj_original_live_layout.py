"""Static regressions for the original Blaise V6 RJ layout.

Run with: python3 -m unittest scripts/test_rj_original_live_layout.py -v
These tests check source wiring and do NOT substitute for Android instrumentation
or live-source/end-to-end validation.
"""
import unittest
from pathlib import Path

SOURCE = (
    Path(__file__).resolve().parents[1]
    / "app/src/main/java/br/com/blaise/rj/MainActivity.kt"
)
TEXT = SOURCE.read_text(encoding="utf-8")


class OriginalLiveDashboardLayoutTest(unittest.TestCase):
    def test_landscape_matches_reference_structure(self):
        home = TEXT.split("private fun HomeScreen(", 1)[1].split(
            "@Composable\nprivate fun CompactServicesRow", 1
        )[0]
        self.assertIn('testTag("reference-three-column-dashboard")', home)
        self.assertIn('testTag("reference-lower-dashboard")', home)
        self.assertLess(home.index('CityPanel("Cidade 1"'), home.index('ExpandedRadarPanel('))
        self.assertLess(home.index('ExpandedRadarPanel('), home.index('CityPanel("Cidade 2"'))
        self.assertIn("DailyChartPanel(city1", home)
        self.assertIn("AirQualitySummaryPanel(", home)
        self.assertIn("RiskPanel(", home)
        self.assertIn("CompactNewsAndSeismicPanel(", home)

    def test_portrait_keeps_cities_and_map(self):
        home = TEXT.split("private fun HomeScreen(", 1)[1].split(
            "@Composable\nprivate fun CompactServicesRow", 1
        )[0]
        portrait = home.split("// Portrait: show the two municipality cards", 1)[1]
        self.assertLess(portrait.index("CityPair("), portrait.index("ExpandedRadarPanel("))
        self.assertIn("RjOriginalLiveOverview(", portrait)

    def test_missing_observations_are_not_replaced_by_mock_values(self):
        city_panel = TEXT.split("private fun CityPanel(", 1)[1].split(
            "@Composable\nprivate fun BackendRainfallPanel", 1
        )[0]
        self.assertIn('?: "— °C"', city_panel)
        self.assertIn('"Estimativa internacional atual não confirmada"', city_panel)
        self.assertIn("international.validAt.atZone(", city_panel)
        self.assertIn("Fonte: ${international.source}", city_panel)
        self.assertIn("LocalInternational92.current?.municipality(city.ibgeCode,clock)", city_panel)
        self.assertIn('"Estimativa internacional atual • modelo, não estação"', city_panel)
        self.assertNotIn('Text("28°C")', city_panel)
        self.assertNotIn('Text("27°C")', city_panel)

    def test_excluded_sources_not_in_operational_marine_panel(self):
        marine = TEXT.split("private fun MarinePanel(", 1)[1].split(
            "@Composable\nprivate fun RiskPanel", 1
        )[0]
        for forbidden in ("INEA", "Marinha", "Copernicus", "Windy"):
            with self.subTest(source=forbidden):
                self.assertNotIn(forbidden, marine)


if __name__ == "__main__":
    unittest.main()
