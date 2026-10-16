package br.com.blaise.rj.assistant

import br.com.blaise.rj.core.City
import br.com.blaise.rj.data.*
import java.time.Instant
import java.time.LocalDate
import org.junit.Assert.*
import org.junit.Test

class LiveInformationAnswersTest {
    private val now = Instant.parse("2026-10-14T16:00:00Z")
    private fun request(question: String, date: LocalDate = LocalDate.parse("2026-10-14")) = WeatherRequest(City("Niterói", 3303302), question, date, null)
    @Test fun `assistant reads the same news snapshot as cards`() {
        val news = NewsSnapshot(now, listOf(NewsHeadline("Chuva em Niterói", "https://agenciabrasil.ebc.com.br/geral/noticia/1", now.minusSeconds(60), false)))
        assertTrue(liveInformationAnswer(null, news, null, request("notícias"), now)!!.contains("Chuva em Niterói"))
        assertFalse(liveInformationAnswer(null, news, null, request("notícias"), now.plusSeconds(301))!!.contains("Chuva em Niterói"))
    }
    @Test fun `absent or future risk products never become safety or forecast claims`() {
        assertTrue(liveInformationAnswer(null, null, null, request("alerta"), now)!!.contains("não significa ausência de risco"))
        assertTrue(liveInformationAnswer(null, null, null, request("alerta amanhã", LocalDate.parse("2026-10-15")), now)!!.contains("Não há previsão validada"))
        assertNull(liveInformationAnswer(null, null, null, request("temperatura"), now))
    }
    private fun official() = PublicRjStatus(now,
        br.com.blaise.rj.cities.RioMunicipalities.all.map {
            PublicRjMunicipality(it.ibgeCode, it.name, null, emptyList(), "EXACT_IBGE_ONLY")
        }, emptyList(), nationalAlerts = NationalCemadenStatus(now, now.minusSeconds(30), listOf(
            NationalCemadenAlert("real-shape-fixture", 3303302, "Niterói", "Movimentos de Massa - Moderado", "Moderado", "2026-10-14 12:00:00")
        )), aerodromeObservations = AerodromeStatus("CURRENT_DEGRADED", "hourly", now, listOf(
            AerodromeObservation("SBGL", "Galeão", 3304557, now.minusSeconds(1800), 27.0, 11.0, null, 1010.0)
        )))

    @Test fun nationalAlertsAreAnsweredFromTheMunicipalLiveSnapshot() {
        val answer = liveInformationAnswer(official(), null, null, request("risco de deslizamento"), now)!!
        assertTrue(answer.contains("Movimentos de Massa"))
        assertTrue(answer.contains("CEMADEN nacional"))
        assertFalse(answer.contains("sem produto validado"))
        assertFalse(liveInformationAnswer(official(), null, null, request("deslizamento"), now.plusSeconds(301))!!.contains("Movimentos de Massa"))
    }

    @Test fun airportBulletinsNeverBecomeAnotherCityOrForecastOrCentreMeasurement() {
        assertNull(liveInformationAnswer(official(), null, null, request("temperatura"), now))
        val rio = WeatherRequest(City("Rio de Janeiro",3304557), "temperatura e vento", LocalDate.parse("2026-10-14"), "Centro do Rio")
        val answer = liveInformationAnswer(official(), null, null, rio, now)!!
        assertTrue(answer.contains("27.0 °C"))
        assertTrue(answer.contains("nem medição específica de Centro do Rio"))
        assertTrue(answer.contains("Galeão"))
        assertFalse(answer.contains("rajada 0"))
        assertNull(liveInformationAnswer(official(), null, null, rio.copy(question="previsão de temperatura"), now))
        assertNull(liveInformationAnswer(official(), null, null, rio, now.plusSeconds(301)))
    }
}
