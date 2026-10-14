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
}
