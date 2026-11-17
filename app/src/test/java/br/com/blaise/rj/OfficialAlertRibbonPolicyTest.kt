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
        sourceUpdatedAt = Instant.parse("2026-11-17T15:58:00Z"),
        rjCoverageValidated = true, verifiedByBackend = verified,
    )

    @Test fun neverPersistAlertBodiesHistoriesOrAcceptOpenweatherAsOfficialSource() {
        assertFalse(OfficialAlertRibbonPolicy.PERSIST_OFFICIAL_NOTICES)
        assertFalse(OfficialAlertRibbonPolicy.PERSIST_OFFICIAL_NOTICE_HISTORY)
        assertFalse(OfficialAlertRibbonPolicy.DISPLAY_PROVIDER_ALERT_BODY)
        assertFalse(OfficialAlertRibbonPolicy.ACCEPT_OPENWEATHER_AS_OFFICIAL_WARNING_SOURCE)
        assertFalse(OfficialAlertRibbonPolicy.portals.any {
            it.id.contains("openweather", ignoreCase = true)
        })
        val old = evidence(5).copy(
            portalId = "openweather-agent13",
            warningId = "provider-modeled-not-official"
        )
        assertNull(OfficialAlertRibbonPolicy.present("openweather-agent13", old, now).level)
        assertTrue(OfficialAlertRibbonPolicy.layout(listOf(old), now)
            .visible.all { !it.presentation.activeValidatedAlert })
    }

    @Test fun sixHourLimitUsesOfficialPublicationNotLastBackendCheck() {
        val checkNow = Instant.parse("2026-11-17T16:00:00Z")
        val updatedSixHoursAgo = evidence(5).copy(
            checkedAt = checkNow.minusSeconds(10),
            sourceUpdatedAt = checkNow.minusSeconds(6 * 3600),
            validFrom = checkNow.minusSeconds(7 * 3600),
            validUntil = checkNow.plusSeconds(3600),
        )
        assertEquals(6L, OfficialAlertRibbonPolicy.MAX_OFFICIAL_SOURCE_SILENCE_HOURS)
        assertEquals(5, OfficialAlertRibbonPolicy.present(
            "inpe-cptec-avisos", updatedSixHoursAgo, checkNow).level)
        val staleEvenIfCheckedNow = updatedSixHoursAgo.copy(
            sourceUpdatedAt = checkNow.minusSeconds(6 * 3600 + 1),
            checkedAt = checkNow,
        )
        val state = OfficialAlertRibbonPolicy.present(
            "inpe-cptec-avisos", staleEvenIfCheckedNow, checkNow)
        assertFalse(state.activeValidatedAlert)
        assertNull(state.level)
        assertTrue(state.message.contains("NÃO VERIFICADOS"))
        val page = OfficialAlertRibbonPolicy.layout(listOf(staleEvenIfCheckedNow), checkNow)
        assertTrue(page.visible.all { !it.presentation.activeValidatedAlert })
        assertTrue(page.additional.isEmpty())
    }

    @Test fun noAuthorityUpdateTimestampOrFutureTimestampFailsClosed() {
        val missing = evidence(4).copy(sourceUpdatedAt = null)
        assertNull(OfficialAlertRibbonPolicy.present(
            "inpe-cptec-avisos", missing, now).level)
        val future = evidence(4).copy(sourceUpdatedAt = now.plusSeconds(1))
        assertNull(OfficialAlertRibbonPolicy.present(
            "inpe-cptec-avisos", future, now).level)
        val afterCheck = evidence(4).copy(sourceUpdatedAt = now)
        assertNull(OfficialAlertRibbonPolicy.present(
            "inpe-cptec-avisos", afterCheck, now).level)
    }

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

    @Test fun fourPermanentOfficialSourcesStayOnTopAndExtraWarningsGoToMais() {
        val records = (1..6).map { index ->
            evidence(if (index == 6) 5 else index).copy(
                warningId = "verified-unique-$index"
            )
        }
        val page = OfficialAlertRibbonPolicy.layout(records, now)
        assertEquals(4, page.visible.size)
        assertEquals(OfficialAlertRibbonPolicy.portals.map { it.id },
            page.visible.map { it.portal.id })
        // Even six warnings from just one source must not remove the other portals.
        assertEquals(listOf(null, null, null, 5), page.visible.map { it.presentation.level })
        assertEquals(5, page.additional.size)
        assertEquals(listOf(5, 4, 3, 2, 1), page.additional.map { it.presentation.level })
        assertTrue(page.additional.all { it.presentation.activeValidatedAlert })
        assertTrue(page.visible.take(3).all { !it.presentation.activeValidatedAlert })
    }

    @Test fun eachPortalShowsItsHighestVerifiedWarningButNeverDuplicatesInMais() {
        val alerts = listOf(
            evidence(2).copy(portalId = "alerta-rio", warningId = "rio-warning-1"),
            evidence(4).copy(portalId = "alerta-rio", warningId = "rio-warning-2"),
            evidence(3).copy(portalId = "inmet-avisos", warningId = "inmet-warning-1"),
        )
        val page = OfficialAlertRibbonPolicy.layout(alerts, now)
        assertEquals(listOf(4, null, 3, null), page.visible.map { it.presentation.level })
        assertEquals(listOf("rio-warning-1"), page.additional.map { it.warningId })
        assertEquals("alerta-rio", page.additional.first().portal.id)
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
