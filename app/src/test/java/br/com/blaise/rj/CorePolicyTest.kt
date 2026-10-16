package br.com.blaise.rj

import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.core.*
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.text.Collator
import java.util.Locale

class CorePolicyTest {
    @Test fun `RJ catalog has 92 unique ordered municipalities`() {
        val cities = RioMunicipalities.all
        assertEquals(92, cities.size)
        assertEquals(92, cities.map { it.name }.toSet().size)
        val portuguese = Collator.getInstance(Locale("pt", "BR"))
        assertEquals(cities.map { it.name }.sortedWith(portuguese), cities.map { it.name })
    }

    @Test fun `P0 remains accessible without entitlement`() {
        val now = Instant.parse("2026-01-01T00:00:00Z")
        val alert = OfficialAlert("p0", null, "Emergência", "Defesa Civil", Severity.P0, now, now.plusSeconds(600))
        assertTrue(AccessPolicy.canReadAlert(alert, Entitlement(active = false)))
    }

    @Test fun `paid content is fail closed without entitlement`() {
        val now = Instant.parse("2026-01-01T00:00:00Z")
        val alert = OfficialAlert("regular", null, "Atenção", "INMET", Severity.YELLOW, now, now.plusSeconds(600))
        assertFalse(AccessPolicy.canReadAlert(alert, Entitlement(active = false)))
    }

    @Test fun `official sources precede fallback sources`() {
        val ordered = FailoverPolicy.ordered(listOf(SourceEndpoint("fallback", 1, false), SourceEndpoint("official", 2, true)))
        assertEquals("official", ordered.first().name)
    }
}
