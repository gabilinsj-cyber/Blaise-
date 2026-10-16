package br.com.blaise.rj.push

import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.core.City
import br.com.blaise.rj.core.OfficialAlert
import br.com.blaise.rj.core.Severity
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class P0DeliveryPolicyTest {
    private val issuedAt = Instant.parse("2026-09-09T12:00:00Z")
    private val expiresAt = Instant.parse("2026-09-09T13:00:00Z")
    private val rio = requireNotNull(RioMunicipalities.byIbgeCode(3304557))
    private val niteroi = requireNotNull(RioMunicipalities.byIbgeCode(3303302))
    private val saoGoncalo = requireNotNull(RioMunicipalities.byIbgeCode(3304904))

    private fun alert(city: City?): OfficialAlert = OfficialAlert(
        id = "p0-routing-test",
        city = city,
        title = "Alerta oficial",
        source = "Defesa Civil RJ",
        severity = Severity.P0,
        issuedAt = issuedAt,
        expiresAt = expiresAt,
    )

    @Test
    fun stateWideP0IsDeliveredToEverySubscriber() {
        assertTrue(P0DeliveryPolicy.shouldDeliver(alert(null), emptyList()))
        assertTrue(P0DeliveryPolicy.shouldDeliver(alert(null), listOf(rio, niteroi)))
    }

    @Test
    fun municipalityP0IsDeliveredWhenEitherSelectedSlotMatches() {
        assertTrue(P0DeliveryPolicy.shouldDeliver(alert(niteroi), listOf(niteroi, rio)))
        assertTrue(P0DeliveryPolicy.shouldDeliver(alert(niteroi), listOf(rio, niteroi)))
    }

    @Test
    fun municipalityP0IsSuppressedWhenNeitherSelectedSlotMatches() {
        assertFalse(P0DeliveryPolicy.shouldDeliver(alert(niteroi), listOf(rio, saoGoncalo)))
    }

    @Test
    fun parsedCanonicalCityScopeFeedsTheDeliveryPolicy() {
        val payload = mapOf(
            "schemaVersion" to "1",
            "eventType" to "p0_official_alert",
            "authority" to "official",
            "severity" to "P0",
            "alertId" to "official-city-3303302",
            "title" to "Alerta oficial para Niterói",
            "source" to "Defesa Civil RJ",
            "issuedAt" to "2026-09-09T11:55:00Z",
            "expiresAt" to "2026-09-09T13:00:00Z",
            "cityName" to "Niterói",
            "cityIbge" to "3303302",
        )
        val parsed = P0PushParser.parse(payload, Instant.parse("2026-09-09T12:00:00Z"))
        assertNotNull(parsed)
        assertTrue(P0DeliveryPolicy.shouldDeliver(requireNotNull(parsed), listOf(rio, niteroi)))
        assertFalse(P0DeliveryPolicy.shouldDeliver(parsed, listOf(rio, saoGoncalo)))
    }
}
