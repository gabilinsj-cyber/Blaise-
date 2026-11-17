package br.com.blaise.rj.assistant

import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.data.*
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class StatewideAnswersTest {
    private val now=Instant.parse("2026-11-17T14:00:00Z")
    private val city=RioMunicipalities.all.first { it.ibgeCode==3305802 }
    private val date=now.atZone(ZoneId.of("America/Sao_Paulo")).toLocalDate()
    private fun snapshot()=StatewideSnapshot(now,true,RioMunicipalities.all.map {
        StatewideMunicipality(it.ibgeCode,it.name,false,
            StatewideRisk("UNAVAILABLE",null,null,null,null,null),
            emptyList(),"UNAVAILABLE")
    }, emptyList(),listOf(StatewideSource("noaa","NOAA",listOf("ondas"),
        "COBERTURA_CONFORME_PRODUTO","NOT_CONNECTED",null)))

    @Test fun neverRevealsDomesticComparatorOrFabricatesWarnings() {
        val answer=statewideAnswer(snapshot(),
            WeatherRequest(city,"Qual alerta em Teresópolis?",date,null),now)!!
        assertTrue(answer.contains("indisponíveis"))
        assertFalse(answer.contains("INMET"))
        assertFalse(answer.contains("CEMADEN"))
        assertFalse(answer.contains("ALTO"))
    }
    @Test fun neverUsesExpiredSnapshotOrCurrentRiskAsForecast() {
        assertTrue(statewideAnswer(snapshot(),WeatherRequest(city,"Qual risco?",date,null),
            now.plusSeconds(121))!!.contains("indisponíveis"))
        assertTrue(statewideAnswer(snapshot(),WeatherRequest(city,"Qual risco amanhã?",
            date.plusDays(1),null),now)!!.contains("não substituem previsão"))
    }
    @Test fun doesNotInferLandslideRiskFromHydrologicalRisk() {
        val answer=statewideAnswer(snapshot(),WeatherRequest(city,"Deslizamento?",
            date,null),now)!!
        assertTrue(answer.contains("não é deduzido"))
        assertFalse(answer.contains("INMET"))
        assertNull(statewideAnswer(snapshot(),WeatherRequest(city,"Temperatura?",date,null),now))
    }
    @Test fun acceptsAlertsForMunicipalityOutsideOriginalPair() {
        assertTrue(WeatherConversation().accept("Qual alerta para Teresópolis?",
            city,date) is ConversationAction.Query)
    }
}
