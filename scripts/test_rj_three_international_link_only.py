"""Static fail-closed contract checks. Run locally before expensive cloud build."""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
read=lambda path:(ROOT/path).read_text(encoding='utf-8')
UI=read('app/src/main/java/br/com/blaise/rj/MainActivity.kt')
ALERT=read('app/src/main/java/br/com/blaise/rj/data/RjPublicOfficialAlertOnly.kt')
RULE=read('backend/src/rj-international-source-policy.mjs')


def function_body(start, stop):
    return UI.split(start,1)[1].split(stop,1)[0]


class LinkOnlyAndTripleProviderTest(unittest.TestCase):
    def test_three_international_sources_and_licensed_brazilian_reference(self):
        self.assertIn('chooseFromThreeInternationalSources({',RULE)
        self.assertIn('comparisonPermissionConfirmed && brazilianReference',RULE)
        self.assertIn('REQUEST_THIRD_INTERNATIONAL_SOURCE',RULE)
        self.assertIn('CLOSEST_TO_PERMITTED_BRAZILIAN_REFERENCE',RULE)
        self.assertIn('INTERNATIONAL_CONSENSUS',RULE)
        self.assertIn('PUBLISH_VALID_INTERNATIONAL',RULE)
        self.assertIn('NO_VALID_INTERNATIONAL_SOURCE',RULE)

    def test_public_warning_metadata_stripped_at_boundary(self):
        self.assertIn('event = "Consulte o aviso na fonte oficial."',ALERT)
        self.assertIn('severity = "Detalhes no portal"',ALERT)
        self.assertIn('LocalOfficialWarningHistory provides emptyList()',UI)
        self.assertIn('phrase:\'Aviso público oficial: consulte o comunicado',RULE)
        self.assertNotIn('action:\'SHOW_OFFICIAL_ALERT\'',RULE)

    def test_warning_ribbon_is_neutral_phrase_and_link(self):
        ribbon=function_body('private fun PublicOfficialWarningRibbon(', 'private fun PublicMunicipalStatusLine(')
        self.assertIn('Aviso público no INMET',ribbon)
        self.assertIn('uri.openUri("https://avisos.inmet.gov.br/")',ribbon)
        self.assertNotIn('warning.second.event',ribbon)
        self.assertNotIn('warning.second.severity',ribbon)
        banner=function_body('private fun OfficialStatusBanner(', 'private fun CityPanel(')
        self.assertIn('Alertas públicos: consulte',banner)
        self.assertNotIn('ALERTA P0',banner)

    def test_city_alerts_are_only_links(self):
        city=function_body('private fun PublicMunicipalStatusLine(', 'private fun StatewideMunicipalitiesPanel(')
        self.assertNotIn('risk.level',city)
        self.assertNotIn('warning.event',city)
        self.assertIn('https://avisos.inmet.gov.br/',city)
        history=function_body('private fun MunicipalAlertValidityPanel(', 'private fun MarineWarningHistoryPanel(')
        self.assertNotIn('warning.severity',history)

    def test_news_never_displays_source_headline_text(self):
        news=function_body('private fun LiveNewsHeadlines(', 'private fun HistoryScreen(')
        self.assertIn('Notícia publicada: consulte a reportagem na fonte oficial.',news)
        self.assertNotIn('Text(item.title',news)
        self.assertIn('uri.openUri(item.url)',news)

if __name__ == '__main__':
    unittest.main()
