package br.com.blaise.rj

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class OfficialAlertRibbonPolicyTest {
    private val now = Instant.parse("2026-11-17T16:00:00Z")
    private fun evidence(level: Int, verified: Boolean = true) = VerifiedBlaiseAlertEvidence(
        portalId = "inpe-cptec-avisos", warningId = "verified-20261117-001", level = level,
        checkedAt = Instant.parse("2026-11-17T15:59:00Z"),
        validFrom = Instant.parse("2026-11-17T15:00:00Z"),
        validUntil = Instant.parse("2026-11-17T18:00:00Z"),
        rjCoverageValidated = true, verifiedByBackend = verified,
    )

    @Test fun fourDirectLinksAreApprovedWithoutActiveWarningClaim() {
        assertEquals(listOf("alerta-rio", "defesa-civil-rj", "inmet-avisos",
            "inpe-cptec-avisos"), OfficialAlertRibbonPolicy.portals.map { it.id })
        assertTrue(OfficialAlertRibbonPolicy.portals.all { it.url.startsWith("https://") })
        for (portal in OfficialAlertRibbonPolicy.portals) {
            val state = OfficialAlertRibbonPolicy.present(portal.id, null, now)
            assertFalse(state.activeValidatedAlert)
            assertNull(state.level)
            assertTrue(state.message.contains("NÃO VERIFICADOS"))
        }
    }

    @Test fun allFiveLightBandsRequireValidBackendEvidence() {
        for (level in 1..5) {
            val state = OfficialAlertRibbonPolicy.present("inpe-cptec-avisos", evidence(level), now)
            assertTrue(state.activeValidatedAlert)
            assertEquals(level, state.level)
            assertTrue(state.message.contains("NÍVEL $level"))
        }
        assertEquals(5, OfficialAlertRibbonPolicy.legend().size)
        assertTrue(OfficialAlertRibbonPolicy.legend().all { !it.activeValidatedAlert })
    }

    @Test fun onlyFourHighestVerifiedAlertsAppearOnTopAndRestStayInMais() {
        val records = (1..6).map { index ->
            evidence(if (index == 6) 5 else index).copy(
                warningId = "verified-unique-$index"
            )
        }
        val page = OfficialAlertRibbonPolicy.layout(records, now)
        assertEquals(4, page.visible.size)
        assertEquals(2, page.additional.size)
        assertEquals(listOf(5, 5, 4, 3), page.visible.map { it.presentation.level })
        assertEquals(listOf(2, 1), page.additional.map { it.presentation.level })
        assertTrue(page.visible.all { it.presentation.activeValidatedAlert })
        assertTrue(page.additional.all { it.presentation.activeValidatedAlert })
    }

    @Test fun unverifiedAlertsAreNotPutInMaisAndFourNeutralLinksRemain() {
        val fake = evidence(5, verified = false)
        val page = OfficialAlertRibbonPolicy.layout(listOf(fake), now)
        assertEquals(4, page.visible.size)
        assertTrue(page.additional.isEmpty())
        assertTrue(page.visible.all { it.presentation.level == null && !it.presentation.activeValidatedAlert })
        assertEquals(OfficialAlertRibbonPolicy.portals.map { it.id }, page.visible.map { it.portal.id })
    }

    @Test fun mismatchedUnverifiedAndExpiredWarningsNeverColorPortal() {
        assertNull(OfficialAlertRibbonPolicy.present("inmet-avisos", evidence(5), now).level)
        assertNull(OfficialAlertRibbonPolicy.present("inpe-cptec-avisos", evidence(5, false), now).level)
        assertNull(OfficialAlertRibbonPolicy.present("inpe-cptec-avisos", evidence(5),
            Instant.parse("2026-11-18T16:00:00Z")).level)
        assertNull(OfficialAlertRibbonPolicy.present("inpe-cptec-avisos", evidence(0), now).level)
    }
}
