package br.com.blaise.rj.data

import br.com.blaise.rj.cities.RioMunicipalities
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class StatewideSnapshotTest {
    private val now = Instant.parse("2026-10-08T10:00:00Z")
    private val risk = StatewideRisk("CURRENT", "ALTO", 4, now.minusSeconds(60), "https://fixture.invalid", "Fixture")
    private val sources = listOf(StatewideSource("inmet", "INMET", listOf("avisos"), "Fixture", "CURRENT", "avisos"))
    private fun cities() = RioMunicipalities.all.map { city ->
        StatewideMunicipality(city.ibgeCode, city.name, false, risk, emptyList(), "EXACT_IBGE_ONLY")
    }
    @Test fun canonicalAllMunicipalitiesKeepSourceValidity() {
        val sample = StatewideSnapshot(now, true, cities(), emptyList(), sources)
        assertEquals(92, sample.municipalities.size)
        assertTrue(sample.current(now))
        assertFalse(sample.current(now.plusSeconds(121)))
        assertTrue(risk.current(now))
        assertFalse(risk.copy(observedAt = now.minusSeconds(1801)).current(now))
        assertFalse(risk.copy(observedAt = now.plusSeconds(1)).current(now))
        assertFalse(risk.copy(state = "STALE").current(now))
    }
    @Test(expected = IllegalArgumentException::class) fun rejectsMissingMunicipality() {
        StatewideSnapshot(now, true, cities().dropLast(1), emptyList(), sources)
    }
    @Test(expected = IllegalArgumentException::class) fun rejectsWarningAssignedToAnotherMunicipality() {
        val warning = StatewideWarning("fixture", "Fixture storm", "Severe", now.minusSeconds(60), now.minusSeconds(60), now.plusSeconds(600), listOf(3305802), "EXACT_IBGE")
        val wrong = cities().map { if (it.ibge == 3303302) it.copy(warningIds = listOf("fixture")) else it }
        StatewideSnapshot(now, true, wrong, listOf(warning), sources)
    }
    @Test(expected = IllegalArgumentException::class) fun rejectsMunicipalityNameMismatch() {
        val wrong = cities().toMutableList()
        wrong[0] = wrong[0].copy(name = "Nome de outra cidade")
        StatewideSnapshot(now, true, wrong, emptyList(), sources)
    }
}
