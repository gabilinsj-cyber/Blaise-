package br.com.blaise.rj.data

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RjMeteorologicalClientTest {
    private val now = Instant.parse("2026-10-10T18:00:00Z")
    private fun station(
        ibge: Int = 3304557,
        observed: Instant = now.minusSeconds(1800),
        generated: Instant = now.minusSeconds(30),
        sourceId: String = "INMET_STATION",
    ) = RjOfficialStationMetric(
        ibge = ibge, variable = RjObservedVariable.TEMPERATURE,
        value = 28.5, unit = "°C", sourceId = sourceId,
        stationId = "A652", observedAt = observed,
        sourceUrl = "https://apitempo.inmet.gov.br/estacao/2026-10-09/2026-10-10/A652",
        generatedAt = generated,
    )

    @Test fun endpointMustUseHttpsWithoutCredentialsOrPath() {
        assertNotNull(RjMeteorologicalHttpsClient.create("https://blaise-v6-rj.example.org"))
        assertNull(RjMeteorologicalHttpsClient.create(""))
        assertNull(RjMeteorologicalHttpsClient.create("http://blaise-v6-rj.example.org"))
        assertNull(RjMeteorologicalHttpsClient.create("https://someone:password@blaise.example.org"))
        assertNull(RjMeteorologicalHttpsClient.create("https://blaise.example.org/private"))
        assertNull(RjMeteorologicalHttpsClient.create("https://blaise.example.org/?purchaseToken=SECRET"))
    }

    @Test fun stationMetricPreservesSourceAndExpiresWithoutFalseRealTimeStatus() {
        val metric = station()
        assertTrue(metric.current(now))
        assertEquals(3304557, metric.ibge)
        assertFalse(metric.copy(generatedAt = now.minusSeconds(240)).current(now))
        assertFalse(metric.copy(observedAt = now.minusSeconds(9000)).current(now))
        assertFalse(metric.copy(observedAt = now.plusSeconds(5)).current(now))
        assertFalse(metric.copy(ibge = 4106902).current(now))
        assertFalse(metric.copy(sourceId = "WINDY_MODELO").current(now))
        assertFalse(metric.copy(sourceUrl = "http://example.org").current(now))
    }

    @Test fun fiveMeasuredVariablesCannotConfuseModelWithObservation() {
        assertEquals(
            setOf("TEMPERATURA_C", "UMIDADE_PERCENTUAL", "VENTO_KMH",
                "RAJADA_KMH", "CHUVA_MM_1H"),
            RjObservedVariable.entries.map { it.backendCode }.toSet(),
        )
        assertFalse(station(sourceId = "INPE_CPTEC_FORECAST").current(now))
    }
}
