package br.com.blaise.rj

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class OfficialAlertRibbonPolicyTest {
    private val now = Instant.parse("2026-11-22T13:00:00Z")
    private fun evidence(
        level: Int, portal: String = "inmet-avisos", name: String = "verified-001"
    ) = VerifiedBlaiseAlertEvidence(
        portalId = portal, warningId = name, level = level,
        checkedAt = now.minusSeconds(10),
        validFrom = now.minusSeconds(240),
        validUntil = now.plusSeconds(1800),
        sourceUpdatedAt = now.minusSeconds(90),
        rjCoverageValidated = true,
        verifiedByBackend = true,
        highSeverityRealtimeInputsVerified = true,
        highSeverityScientificDecisionVerified = true,
        highSeverityRecalculatedAt = now.minusSeconds(10),
    )

    @Test fun exactlyThreeHeaderCardsAndRemainingOfficialLinksUnderMore() {
        val page = OfficialAlertRibbonPolicy.layout(emptyList(), now)
        assertEquals(3, OfficialAlertRibbonPolicy.MAX_TOP_ALERTS)
        assertEquals(3, page.visible.size)
        assertEquals(1, page.additional.size)
        assertEquals(listOf("alerta-rio", "defesa-civil-rj", "inmet-avisos"),
            page.visible.map { it.portal.id })
        assertEquals("inpe-cptec-avisos", page.additional.single().portal.id)
        assertTrue((page.visible + page.additional).all { !it.presentation.activeValidatedAlert })
        assertTrue((page.visible + page.additional).all { it.portal.url.startsWith("https://") })
    }

    @Test fun levelFourAndFiveFailClosedUnlessRecalculatedWithRealtimeEvidence() {
        for (level in 4..5) {
            val good = evidence(level)
            assertEquals(level, OfficialAlertRibbonPolicy.present(good.portalId, good, now).level)
            val noScience = good.copy(highSeverityScientificDecisionVerified = false)
            val noRealtime = good.copy(highSeverityRealtimeInputsVerified = false)
            val staleMath = good.copy(highSeverityRecalculatedAt = now.minusSeconds(21))
            val staleCheck = good.copy(checkedAt = now.minusSeconds(21))
            val missingTime = good.copy(highSeverityRecalculatedAt = null)
            for (bad in listOf(noScience, noRealtime, staleMath, staleCheck, missingTime)) {
                val result = OfficialAlertRibbonPolicy.present(bad.portalId, bad, now)
                assertFalse(result.activeValidatedAlert)
                assertNull(result.level)
            }
        }
        assertEquals(20L, OfficialAlertRibbonPolicy.HIGH_SEVERITY_RECALC_SECONDS)
    }

    @Test fun lowerLevelsNeedTrueAuthorityEvidenceButNotTwentySecondMath() {
        for (level in 1..3) {
            val good = evidence(level).copy(
                checkedAt = now.minusSeconds(60),
                highSeverityScientificDecisionVerified = false,
                highSeverityRealtimeInputsVerified = false,
                highSeverityRecalculatedAt = null
            )
            assertEquals(level, OfficialAlertRibbonPolicy.present(good.portalId, good, now).level)
            assertNull(OfficialAlertRibbonPolicy.present(good.portalId,
                good.copy(sourceUpdatedAt = null), now).level)
            assertNull(OfficialAlertRibbonPolicy.present(good.portalId,
                good.copy(verifiedByBackend = false), now).level)
        }
    }

    @Test fun extraWarningsAndFourthPortalNeverDisappear() {
        val items = listOf(
            evidence(5, "inpe-cptec-avisos", "severe-cptec"),
            evidence(4, "defesa-civil-rj", "severe-defesa"),
            evidence(3, "alerta-rio", "alert-rio"),
            evidence(2, "alerta-rio", "second-rio"),
            evidence(1, "inmet-avisos", "inmet")
        )
        val page = OfficialAlertRibbonPolicy.layout(items, now)
        assertEquals(listOf(5,4,3), page.visible.map { it.presentation.level })
        assertEquals(listOf(2,1), page.additional.map { it.presentation.level })
        assertEquals(5, (page.visible + page.additional).count { it.presentation.activeValidatedAlert })
    }

    @Test fun invalidNonOfficialWarningsCannotCreateColorsOrCopiedContent() {
        val fake = evidence(5, "openweather-agent13")
        val page = OfficialAlertRibbonPolicy.layout(listOf(fake), now)
        assertTrue(page.visible.none { it.presentation.activeValidatedAlert })
        assertFalse(OfficialAlertRibbonPolicy.PERSIST_OFFICIAL_NOTICES)
        assertFalse(OfficialAlertRibbonPolicy.DISPLAY_PROVIDER_ALERT_BODY)
        assertFalse(OfficialAlertRibbonPolicy.ACCEPT_OPENWEATHER_AS_OFFICIAL_WARNING_SOURCE)
        assertEquals(5, OfficialAlertRibbonPolicy.legend().size)
        assertTrue(OfficialAlertRibbonPolicy.legend().all { !it.activeValidatedAlert })
    }
}
