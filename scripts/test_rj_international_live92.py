"""Static checks for source-safe international live 92-city integration.
No API call, Cloud Build, Firestore read or billed service is made.
"""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
read=lambda p:(ROOT/p).read_text(encoding='utf-8')
MAP=read('backend/src/rj-municipal-representative-points.mjs')
COLLECTOR=read('backend/src/rj-international-92-snapshot.mjs')
HTTP=read('backend/src/dashboard-data-http.mjs')
RUNTIME=read('backend/src/runtime.mjs')
ANDROID=read('app/src/main/java/br/com/blaise/rj/MainActivity.kt')
CLIENT=read('app/src/main/java/br/com/blaise/rj/data/RjInternational92Client.kt')
MAPOVERLAY=read('app/src/main/java/br/com/blaise/rj/RjInternational92MapOverlay.kt')
DOC=read('docs/RJ_INTERNATIONAL_92_LIVE_ROLLOUT_20261116.md')

class International92IntegrationChecks(unittest.TestCase):
    def test_ninety_two_geographically_matched_cc0_points(self):
        self.assertEqual(len(re.findall(r"ibge:'33\d{5}',name:",MAP)),92)
        self.assertIn('geodata-br',MAP)
        self.assertIn('RJ_92_REPRESENTATIVE_BY_IBGE',MAP)
        self.assertIn('Math.abs(row.latitude-target.latitude)>0.005',COLLECTOR)
        self.assertIn('Math.abs(row.longitude-target.longitude)>0.005',COLLECTOR)

    def test_licenses_and_entitlement_before_reading(self):
        self.assertIn('if (!entitlement.active)',HTTP)
        self.assertIn('internationalLicenseConfirmed === true',HTTP)
        self.assertIn('BLAISE_RJ_INTL_PAID_READ_ENABLED',RUNTIME)
        self.assertIn('BLAISE_OPENWEATHER_COMMERCIAL_USE_VERIFIED',RUNTIME)
        self.assertIn('candidate.purchaseToken',CLIENT)
        self.assertIn('BLAISE_ENTITLEMENT_VERIFY_URL',ANDROID)

    def test_no_keys_in_app_or_provider_polling_from_android(self):
        self.assertNotIn('OPENWEATHER_API_KEY',CLIENT)
        self.assertNotIn('api.openweathermap.org',CLIENT)
        self.assertIn('NO_CURRENT_INTERNATIONAL_DATA',CLIENT)
        self.assertIn('officialObservation!==false',COLLECTOR)
        self.assertIn('radarAvailable:false',COLLECTOR)

    def test_map_point_samples_not_fake_radar(self):
        self.assertIn('RioGeographicBase(Modifier.fillMaxSize(), mapZoom)',ANDROID)
        self.assertIn('RjInternational92MapOverlay(',ANDROID)
        self.assertIn('rows.forEach',MAPOVERLAY)
        self.assertIn('!alert.isCurrent',read('app/src/main/java/br/com/blaise/rj/alerts/VerifiedRjStageAlertCard.kt'))
        self.assertIn('não interpola',DOC)
        self.assertIn('900 chamadas/dia',DOC)

    def test_only_current_provenance_attributed_weather_cards(self):
        self.assertIn('international?.temperatureC',ANDROID)
        self.assertIn('international?.feelsLikeC',ANDROID)
        self.assertIn('international?.rainMm1h',ANDROID)
        self.assertIn('Estimativa internacional atual',ANDROID)
        self.assertIn('Fonte: ${international.source}',ANDROID)
        self.assertIn('modelPoint = LocalInternational92.current?.municipality',ANDROID)

if __name__=='__main__':
    unittest.main()
