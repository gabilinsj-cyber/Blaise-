package br.com.blaise.rj.push

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant

class P0PushParserTest {
    private val now = Instant.parse("2026-09-06T03:00:00Z")

    private fun validPayload(): Map<String, String> = mapOf(
        "schemaVersion" to "1",
        "eventType" to "p0_official_alert",
        "authority" to "official",
        "severity" to "P0",
        "alertId" to "official-123",
        "title" to "Alerta oficial imediato",
        "source" to "Defesa Civil RJ",
        "issuedAt" to "2026-09-06T02:55:00Z",
        "expiresAt" to "2026-09-06T04:00:00Z",
    )

    @Test
    fun stateWideP0IsAcceptedWithoutEntitlementContext() {
        val alert = P0PushParser.parse(validPayload(), now)
        assertEquals("official-123", alert?.id)
        assertEquals("P0", alert?.severity?.name)
        assertNull(alert?.city)
    }

    @Test
    fun canonicalRjCityIsAccepted() {
        val payload = validPayload() + mapOf(
            "cityName" to "Niterói",
            "cityIbge" to "3303302",
        )
        val alert = P0PushParser.parse(payload, now)
        assertEquals("Niterói", alert?.city?.name)
        assertEquals(3303302, alert?.city?.ibgeCode)
    }

    @Test
    fun nonP0OrNonOfficialPushIsRejected() {
        assertNull(P0PushParser.parse(validPayload() + ("severity" to "RED"), now))
        assertNull(P0PushParser.parse(validPayload() + ("authority" to "unverified"), now))
    }

    @Test
    fun expiredFutureOrOverlongValidityIsRejected() {
        assertNull(P0PushParser.parse(validPayload() + ("expiresAt" to "2026-09-06T02:59:59Z"), now))
        assertNull(P0PushParser.parse(validPayload() + ("issuedAt" to "2026-09-06T03:10:01Z"), now))
        assertNull(
            P0PushParser.parse(
                validPayload() + mapOf(
                    "issuedAt" to "2026-09-06T02:00:00Z",
                    "expiresAt" to "2026-09-07T02:00:01Z",
                ),
                now,
            ),
        )
    }

    @Test
    fun unknownOrMismatchedMunicipalityIsRejected() {
        assertNull(
            P0PushParser.parse(
                validPayload() + mapOf("cityName" to "Cidade Inventada", "cityIbge" to "3303302"),
                now,
            ),
        )
    }
}
