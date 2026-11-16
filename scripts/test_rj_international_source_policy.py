"""Fail-closed checks for the 16/11/2026 international-only display decision.
These are source-contract checks, NOT end-to-end data or license verification.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
POLICY = (ROOT / 'app/src/main/java/br/com/blaise/rj/data/RjInternationalWeatherPolicy.kt').read_text()
WEATHER = (ROOT / 'app/src/main/java/br/com/blaise/rj/data/OfficialWeatherClient.kt').read_text()
ACTIVITY = (ROOT / 'app/src/main/java/br/com/blaise/rj/MainActivity.kt').read_text()
DOC = (ROOT / 'docs/BLAISE_V6_RJ_MASTER_SPEC_20261116.md').read_text()


class InternationalSourceOnlyContractTest(unittest.TestCase):
    def test_no_brazilian_meteorology_acquired_by_public_weather_entrypoints(self):
        self.assertIn('const val ALLOW_BRAZILIAN_OBSERVATIONS_IN_APK = false', POLICY)
        self.assertGreaterEqual(
            WEATHER.count('!RjInternationalWeatherPolicy.ALLOW_BRAZILIAN_OBSERVATIONS_IN_APK'), 6
        )
        self.assertIn('BRAZILIAN_METEOROLOGY_REVIEW_ONLY', WEATHER)
        self.assertIn('RjInternationalWeatherPolicy.PUBLIC_UNAVAILABLE_MESSAGE', WEATHER)
        self.assertIn('INTERNATIONAL_OBSERVATION_UNAVAILABLE', POLICY)

    def test_statewide_and_public_meteorology_are_not_fetched_in_app(self):
        self.assertIn('val publicRjClient: PublicRjStatusHttpsClient? = remember { null }', ACTIVITY)
        self.assertIn('val statewideClient: StatewideDataHttpsClient? = remember { null }', ACTIVITY)
        self.assertIn('val dashboardClient: DashboardDataHttpsClient? = remember { null }', ACTIVITY)
        self.assertIn('rioStations = emptyList() // Official station observations', ACTIVITY)

    def test_no_republication_and_private_review_once_in_thirty_minutes(self):
        self.assertIn('INTERNAL_BRAZILIAN_REVIEW_INTERVAL_MINUTES = 30L', POLICY)
        self.assertIn('"INMET", "Alerta Rio", "Defesa Civil RJ"', POLICY)
        self.assertIn('consulta', DOC.lower())
        self.assertIn('intervalo mínimo de 30 minutos', DOC)
        self.assertIn('sem', DOC.lower())

    def test_exclusions_and_no_false_live_source(self):
        for forbidden in ('INEA', 'Marinha do Brasil/CHM', 'Windy', 'Copernicus'):
            with self.subTest(source=forbidden):
                self.assertIn(forbidden, DOC)
        self.assertIn('INTERNATIONAL_FEED_VERIFIED_AND_CONNECTED = false', POLICY)
        self.assertIn('medição meteorológica publicada', DOC.lower())
        self.assertIn('Nenhuma informação internacional atual foi confirmada', DOC)


if __name__ == '__main__':
    unittest.main()
