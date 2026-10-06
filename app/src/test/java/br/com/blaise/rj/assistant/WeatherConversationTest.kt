package br.com.blaise.rj.assistant
import br.com.blaise.rj.core.City
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate
class WeatherConversationTest {
    private val selected = City("Niterói", 3303302)
    @Test fun stationKeepsLocalCoverageInFollowUp() {
        val c=WeatherConversation()
        val q=c.accept("temperatura e umidade em São Cristóvão",selected) as ConversationAction.Query
        assertEquals("São Cristóvão",q.request.localScope)
        assertEquals(3304557,q.request.city.ibgeCode)
        assertEquals("São Cristóvão",(c.accept("e o vento?",selected) as ConversationAction.Query).request.localScope)
    }
    @Test fun asksLocationThenReusesQuestion() {
        val c = WeatherConversation()
        assertTrue(c.accept("qual a temperatura e a térmica?", selected) is ConversationAction.Reply)
        val q = c.accept("Niterói", selected) as ConversationAction.Query
        assertEquals(3303302, q.request.city.ibgeCode)
        assertTrue(q.request.question.contains("térmica"))
    }
    @Test fun rioUsesCentreAndTomorrowIsNotToday() {
        val q = WeatherConversation().accept("Temperatura amanhã no Rio", selected, LocalDate.of(2026,10,6)) as ConversationAction.Query
        assertEquals("Centro do Rio", q.request.localScope)
        assertEquals(LocalDate.of(2026,10,7), q.request.date)
    }
    @Test fun retainsCentreCoverageOnFollowUp() {
        val c = WeatherConversation()
        c.accept("temperatura no Rio", selected)
        assertEquals("Centro do Rio", (c.accept("e a umidade?", selected) as ConversationAction.Query).request.localScope)
    }
    @Test fun doesNotInventRegionalOrHazardCoverage() {
        assertTrue(WeatherConversation().accept("alertas na Baixada",selected) is ConversationAction.Reply)
        assertTrue(WeatherConversation().accept("ciclone em Niterói",selected) is ConversationAction.Reply)
    }
    @Test fun remembersExplicitCityAndSelectedCityIsOptIn() {
        val c=WeatherConversation()
        c.accept("temperatura em Petrópolis", selected)
        val q=c.accept("e a umidade?",selected) as ConversationAction.Query
        assertEquals("Petrópolis", q.request.city.name)
        assertEquals("Niterói",(c.accept("temperatura na minha cidade",selected) as ConversationAction.Query).request.city.name)
    }
}
