"""Static check: official sources keep the right response contract; no network calls."""
from pathlib import Path
import unittest

SOURCE = (Path(__file__).resolve().parents[1]
          / "app/src/main/java/br/com/blaise/rj/data/OfficialWeatherClient.kt").read_text(encoding="utf-8")


class RjSourceProtocolContractTest(unittest.TestCase):
    def test_explicit_official_source_urls_and_formats(self):
        self.assertIn('https://apitempo.inmet.gov.br/estacoes/T', SOURCE)
        self.assertIn('https://websempre.rio.rj.gov.br/estacoes/', SOURCE)
        self.assertIn('val isAlertaRio = host.equals("websempre.rio.rj.gov.br", ignoreCase = true)', SOURCE)
        self.assertIn('"text/html,application/xhtml+xml;q=0.9"', SOURCE)
        self.assertIn('"application/json"', SOURCE)

    def test_blocked_html_is_not_treated_as_station_measurements(self):
        self.assertIn('SOURCE_PAGE_NOT_MEASUREMENTS', SOURCE)
        self.assertIn('SOURCE_JSON_MISSING', SOURCE)
        self.assertIn('body.contains("Dados Meteorol"', SOURCE)
        self.assertIn('body.contains("<table"', SOURCE)
        self.assertIn('if (isInmet && body.trimStart().firstOrNull()', SOURCE)
        self.assertIn('catch (error: CancellationException)', SOURCE)
        self.assertNotIn('runCatching { currentCityBlocking(request) }', SOURCE)

    def test_source_fails_closed_when_stale_or_unavailable(self):
        self.assertIn('failures.lastOrNull() ?: "NO_CURRENT_LOCAL_MEASUREMENT"', SOURCE)
        # Brazilian station reads must stay disabled in the client, while
        # international estimate failure has a visible missing-data state.
        ui = (Path(__file__).resolve().parents[1]
              / "app/src/main/java/br/com/blaise/rj/MainActivity.kt").read_text(encoding="utf-8")
        self.assertIn('"Estimativa internacional atual não confirmada"', ui)
        self.assertIn('LocalInternational92.current?.municipality(city.ibgeCode,clock)', ui)
        self.assertIn('?: "— °C"', ui)
        self.assertIn('if (conn.responseCode != 200)', SOURCE)


if __name__ == "__main__":
    unittest.main()
