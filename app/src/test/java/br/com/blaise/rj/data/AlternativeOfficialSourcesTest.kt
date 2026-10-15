package br.com.blaise.rj.data

import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject
import java.time.Instant

class AlternativeOfficialSourcesTest {
    private val now = Instant.parse("2026-10-15T19:00:00Z")
    @Test fun wis2WarningKeepsItsOfficialSourceAndExpiry() {
        val warning = PublicRjWarning("urn:oid:fixture", "Tempestade", "Severe",
            now.minusSeconds(60), now.minusSeconds(60), now.plusSeconds(600),
            listOf(3304557), "https://wis2bra.inmet.gov.br/data/")
        assertTrue(warning.current(now))
        assertFalse(warning.current(now.plusSeconds(601)))
        assertFalse(warning.copy(sourceUrl = "https://example.invalid/").current(now))
    }
    @Test fun nationalOpenAlertsDoNotSynthesizeMunicipalRiskOrNewObservationTime() {
        val root = JSONObject("""{"nationalAlerts":{
          "sourceUrl":"https://painelalertas.cemaden.gov.br/wsAlertas2",
          "fetchedAt":"2026-10-15T19:00:00Z","sourceUpdatedAt":"2026-10-15T18:59:00Z",
          "absenceOfRiskProven":false,"municipalRiskLevelProvided":false,
          "alerts":[{"id":"123:3304557","ibge":"3304557","municipality":"Rio de Janeiro",
          "event":"Risco Hidrológico - Alto","officialLevel":"Alto","openedAtRaw":"2026-10-15 15:00:00"}]}}""")
        val status = PublicRjStatusParser.parseNational(root)!!
        assertEquals("2026-10-15 15:00:00", status.alerts.single().openedAtRaw)
        assertEquals(3304557, status.alerts.single().ibge)
        assertTrue(status.current(now))
        assertFalse(status.current(now.plusSeconds(301)))
        root.getJSONObject("nationalAlerts").getJSONArray("alerts").getJSONObject(0).put("municipality", "Niterói")
        assertTrue(runCatching { PublicRjStatusParser.parseNational(root) }.isFailure)
    }
}
