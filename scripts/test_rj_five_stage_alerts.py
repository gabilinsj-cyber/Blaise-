"""Fail-closed static checks for approved RJ stages and level-5 one-shot UX."""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
read=lambda p:(ROOT/p).read_text(encoding="utf-8")
MODEL=read("app/src/main/java/br/com/blaise/rj/alerts/RjFiveStagePublicAlert.kt")
CARD=read("app/src/main/java/br/com/blaise/rj/alerts/VerifiedRjStageAlertCard.kt")
ONCE=read("app/src/main/java/br/com/blaise/rj/alerts/RjStageFiveOneShot.kt")
MANIFEST=read("app/src/main/AndroidManifest.xml")
SPEC=read("docs/BLAISE_V6_RJ_MASTER_SPEC_20261116.md")

class FiveStageAlertContractTest(unittest.TestCase):
    def test_five_backgrounds_and_black_bold_text(self):
        patterns=[
            'ONE(1, 0xFF4ADE80', 'TWO(2, 0xFFA3E635',
            'THREE(3, 0xFFFACC15', 'FOUR(4, 0xFFFB923C',
            'FIVE(5, 0xFFF87171'
        ]
        self.assertTrue(all(p in MODEL for p in patterns))
        self.assertIn('val black = Color.Black',CARD)
        self.assertIn('fontWeight = FontWeight.Bold',CARD)
        self.assertIn('alert.stage.number.toString()',CARD)
        self.assertIn('uriHandler.openUri(alert.officialUrl)',CARD)

    def test_no_unverified_stage_published(self):
        self.assertIn('sourceAuthenticationVerified',MODEL)
        self.assertIn('stageMappingReviewedAndVerified',MODEL)
        self.assertIn('authorizedToDisplayShortMetadata',MODEL)
        self.assertIn('Duration.between(checkedAt, now).seconds !in 0..300',MODEL)
        self.assertIn('if (!alert.isCurrent(now)) return',CARD)
        self.assertIn('alert.isCurrent(now)',ONCE)

    def test_one_only_on_a_transition_to_five_and_persist_first(self):
        self.assertIn('current == RjBlaiseStage.FIVE && previous != RjBlaiseStage.FIVE',MODEL)
        self.assertIn('if (observed < lastChecked) return false',ONCE)
        self.assertIn('.putInt("$key.stage", event.stage.number)',ONCE)
        self.assertIn('.commit()) return false',ONCE)
        self.assertIn('return RjStageFiveTransition.shouldDispatch(previous, event.stage)',ONCE)

    def test_three_beeps_and_three_optional_vibration_pulses(self):
        self.assertIn('speaker.speak(',ONCE)
        self.assertIn('repeat(3)',ONCE)
        self.assertIn('ToneGenerator.TONE_PROP_BEEP',ONCE)
        self.assertIn('longArrayOf(0, 200, 180, 200, 180, 200)',ONCE)
        self.assertIn('if (vibrationEnabled)',ONCE)
        self.assertIn('android.permission.VIBRATE',MANIFEST)
        self.assertIn('android.permission.POST_NOTIFICATIONS',MANIFEST)

    def test_spec_does_not_claim_live_stage_feed(self):
        self.assertIn('O novo feed autenticado com estágio 1–5 ainda não foi conectado',SPEC)
        self.assertIn('push em segundo plano não está validado',SPEC)
        self.assertIn('13 agentes',SPEC)

if __name__=='__main__':
    unittest.main()
