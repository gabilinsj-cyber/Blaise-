package br.com.blaise.rj.data

import java.time.Instant
import org.junit.Assert.*
import org.junit.Test

class LiveInformationPolicyTest {
    private val now = Instant.parse("2026-10-14T16:00:00Z")
    private fun headline(title: String, seconds: Long, international: Boolean = false) =
        NewsHeadline(title, "https://agenciabrasil.ebc.com.br/geral/noticia/$seconds", now.minusSeconds(seconds), international)

    @Test fun `news sorts recent items and never borrows another city`() {
        val snapshot = NewsSnapshot(now, listOf(headline("Rio de Janeiro recebe chuva", 30),
            headline("Niterói divulga boletim", 20), headline("São Gonçalo divulga boletim", 10),
            headline("Notícia internacional", 5, true), headline("Rio de Janeiro antigo", 172801), headline("Rio de Janeiro futuro", -1)))
        assertEquals("São Gonçalo divulga boletim", snapshot.forScope("RJ", now).first().title)
        assertEquals(listOf("Niterói divulga boletim"), snapshot.forScope("Niterói", now).map { it.title })
        assertEquals(1, snapshot.forScope("Internacional", now).size)
        assertEquals(3, snapshot.forScope("Nacional", now).size)
        assertTrue(snapshot.forScope("RJ", now.plusSeconds(301)).isEmpty())
    }

    @Test fun `RSS keeps original publication time and rejects untrusted links and DTD`() {
        fun xml(link: String, date: String) = """<rss><channel><item><title><![CDATA[Chuva no Rio de Janeiro]]></title><link>$link</link><pubDate>$date</pubDate></item></channel></rss>"""
        val stamp = "Wed, 14 Oct 2026 15:00:00 GMT"
        val rows = NewsFeedParser.parse(xml("https://agenciabrasil.ebc.com.br/geral/noticia/1", stamp), false, now)
        assertEquals(Instant.parse("2026-10-14T15:00:00Z"), rows.single().publishedAt)
        assertTrue(NewsFeedParser.parse(xml("https://example.com/1", stamp), false, now).isEmpty())
        assertTrue(NewsFeedParser.parse(xml("https://agenciabrasil.ebc.com.br/1", "bad"), false, now).isEmpty())
        assertTrue(NewsFeedParser.parse(xml("https://agenciabrasil.ebc.com.br/1", "Wed, 14 Oct 2026 17:00:00 GMT"), false, now).isEmpty())
        assertThrows(IllegalArgumentException::class.java) { NewsFeedParser.parse("<!DOCTYPE rss><rss/>", false, now) }
    }

    @Test fun `seismic chooses two greatest in last day and does not renew source clock`() {
        fun event(id: String, mag: Double, age: Long) = SeismicEvent(id, id, mag, 10.0, now.minusSeconds(age), "https://earthquake.usgs.gov/earthquakes/eventpage/$id")
        val snapshot = SeismicSnapshot(now.minusSeconds(60), now, listOf(event("a", 5.0, 10), event("b", 6.0, 60),
            event("old", 9.0, 86401), event("future", 10.0, -1), event("c", 4.0, 20)))
        assertEquals(listOf("b", "a"), snapshot.largestRecent(now).map { it.id })
        assertTrue(snapshot.largestRecent(now.plusSeconds(61)).isEmpty())
    }
}
