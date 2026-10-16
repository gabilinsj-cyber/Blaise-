package br.com.blaise.rj.assistant

import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.data.*
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class StatewideAnswersTest {
    private val now = Instant.parse("2026-10-08T10:00:00Z")
    private val city = RioMunicipalities.all.first { it.ibgeCode == 3305802 }
    private val date = now.atZone(ZoneId.of("America/Sao_Paulo")).toLocalDate()
    private fun snapshot() = StatewideSnapshot(now, true, RioMunicipalities.all.map {
        StatewideMunicipality(it.ibgeCode, it.name, false,
            StatewideRisk("CURRENT", "ALTO", 4, now.minusSeconds(60), "https://fixture.invalid", "Fixture"),
            if (it.ibgeCode == city.ibgeCode) listOf("fixture") else emptyList(), "EXACT_IBGE_ONLY")
    }, listOf(StatewideWarning("fixture", "Tempestade de teste", "Extreme", now.minusSeconds(60), now.minusSeconds(60), now.plusSeconds(600), listOf(city.ibgeCode), "EXACT_IBGE")),
        listOf(StatewideSource("inmet", "INMET", listOf("avisos"), "Fixture", "CURRENT", "avisos")))

    @Test fun retainsOfficialSeverityAndMunicipalOwnership() {
        val answer = statewideAnswer(snapshot(), WeatherRequest(city, "Qual alerta em Teresópolis?", date, null), now)!!
        assertTrue(answer.contains("extrema"))
        assertTrue(answer.contains("INMET"))
        val other = RioMunicipalities.all.first { it.ibgeCode == 3303302 }
        val otherAnswer = statewideAnswer(snapshot(), WeatherRequest(other, "Qual alerta?", date, null), now)!!
        assertFalse(otherAnswer.contains("Tempestade de teste"))
        assertTrue(otherAnswer.contains("não confirma ausência de risco"))
    }
    @Test fun neverUsesExpiredSnapshotOrCurrentRiskAsForecast() {
        assertTrue(statewideAnswer(snapshot(), WeatherRequest(city, "Qual risco?", date, null), now.plusSeconds(121))!!.contains("indisponíveis"))
        assertTrue(statewideAnswer(snapshot(), WeatherRequest(city, "Qual risco amanhã?", date.plusDays(1), null), now)!!.contains("não substituem previsão"))
    }
    @Test fun doesNotInferLandslideRiskFromHydrologicalRisk() {
        val answer = statewideAnswer(snapshot(), WeatherRequest(city, "Deslizamento?", date, null), now)!!
        assertTrue(answer.contains("não é deduzido"))
        assertFalse(answer.contains("ALTO"))
        assertNull(statewideAnswer(snapshot(), WeatherRequest(city, "Temperatura?", date, null), now))
    }
    @Test fun acceptsAlertsForMunicipalityOutsideOriginalPair() {
        assertTrue(WeatherConversation().accept("Qual alerta para Teresópolis?", city, date) is ConversationAction.Query)
    }
}
