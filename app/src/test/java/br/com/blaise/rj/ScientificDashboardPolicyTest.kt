package br.com.blaise.rj

import br.com.blaise.rj.data.CityWeatherObservation
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ScientificDashboardPolicyTest {
    private val now = Instant.parse("2026-10-10T18:00:00Z")
    private fun official(t: Double? = 30.0, rh: Double? = 70.0, wind: Double? = 12.0,
        at: Instant = now.minusSeconds(900)) = CityWeatherObservation(
        3304557, "INMET local (código verificado)", "INMET",
        "https://apitempo.inmet.gov.br/estacao/2026-10-09/2026-10-10/A652",
        at, t, rh, wind, 7200,
    )
    @Test fun heatIndexAndDewpointAreDerivedFromSameRecentStation() {
        val values = ScientificDashboardPolicy.derive(official(), now)
        assertEquals(2, values.size)
        assertTrue(values.any { it.title == "Ponto de orvalho" })
        assertTrue(values.any { it.title == "Sensação térmica" })
        assertTrue(values.all { it.station.contains("INMET") && it.source == "INMET" })
        assertTrue(values.all { !it.officialMeasurement && !it.mayTriggerAlert })
    }
    @Test fun staleMissingHumidityAndOtherDomainCannotCreateSyntheticValues() {
        assertTrue(ScientificDashboardPolicy.derive(null, now).isEmpty())
        assertTrue(ScientificDashboardPolicy.derive(official(at = now.minusSeconds(8600)), now).isEmpty())
        assertTrue(ScientificDashboardPolicy.derive(official(rh = null), now).isEmpty())
        assertTrue(ScientificDashboardPolicy.derive(official(t = null), now).isEmpty())
        assertTrue(ScientificDashboardPolicy.derive(official(t = 19.0), now)
            .none { it.title == "Sensação térmica" })
    }
    @Test fun saturationHasDewpointAtMeasuredTemperature() {
        val dew = ScientificDashboardPolicy.derive(official(t = 25.0, rh = 100.0), now).first()
        assertTrue(dew.value.startsWith("25,0"))
    }
    @Test fun strongWindAtLowTemperatureSupportsWindChillButNotFictitiousHeatIndex() {
        val derived = ScientificDashboardPolicy.derive(official(t = 5.0, rh = 75.0, wind = 25.0), now)
        assertTrue(derived.any { it.method == "Vento-frio" })
        assertFalse(derived.any { it.method.contains("Rothfusz") })
    }
    @Test fun tenAgentsAreOnlyCatalogedNotAdvertisedAsAutonomousOnline() {
        assertEquals((1..10).toList(), BlaiseAgentDashboard.tenAgents.map { it.index })
        assertTrue(BlaiseAgentDashboard.tenAgents.all { it.deploymentStatus.contains("não validada") })
        assertEquals("Auditoria Profunda RJ", BlaiseAgentDashboard.tenAgents.last().name)
    }
}
