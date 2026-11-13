package br.com.blaise.rj

import br.com.blaise.rj.core.City
import br.com.blaise.rj.data.CityWeatherObservation
import br.com.blaise.rj.data.CityWeatherResult
import java.time.Instant
import org.junit.Assert.*
import org.junit.Test

class RjHomeObservedEvidenceTest {
    private val now = Instant.parse("2026-11-13T14:05:00Z")
    private val rio = City("Rio de Janeiro",3304557)
    private val niteroi = City("Niterói",3303302)

    private fun station(source:String,ibge:Int,observed:Instant=now.minusSeconds(60)) =
        CityWeatherObservation(
            municipalityIbge=ibge,
            station="Estação de teste",
            source=source,
            sourceUrl=when(source) {
                "INMET" -> "https://apitempo.inmet.gov.br/estacao/A652"
                "Alerta Rio" -> "https://websempre.rio.rj.gov.br/estacoes/"
                else -> "https://example.org/fixture"
            },
            observedAt=observed,
            temperatureC=27.1,humidityPercent=70.0,
            windKmh=12.0,maxAgeSeconds=1800,
        )

    @Test fun onlyFreshActualStationInSameMunicipalityCanPopulateTheTile() {
        val fresh=CityWeatherResult(rio.ibgeCode,null,station("INMET",rio.ibgeCode))
        assertNotNull(RjHomeObservedEvidence.cityObservation(rio,
            mapOf(rio.ibgeCode to fresh),now))
        assertNull(RjHomeObservedEvidence.cityObservation(niteroi,
            mapOf(niteroi.ibgeCode to fresh),now))
        val expired=CityWeatherResult(rio.ibgeCode,null,
            station("INMET",rio.ibgeCode,now.minusSeconds(400)))
        assertNull(RjHomeObservedEvidence.cityObservation(rio,
            mapOf(rio.ibgeCode to expired),now))
    }

    @Test fun excludedOrUnknownSourcesAreNeverShownAsCurrent() {
        val forbidden=listOf("Marinha do Brasil","CHM","INEA","Copernicus","Windy","UNKNOWN")
        for(source in forbidden) {
            val report=CityWeatherResult(rio.ibgeCode,null,station(source,rio.ibgeCode))
            assertNull(RjHomeObservedEvidence.cityObservation(rio,
                mapOf(rio.ibgeCode to report),now))
        }
    }

    @Test fun sourceNameCannotImpersonateOfficialStationHost() {
        val falseInmet=CityWeatherResult(rio.ibgeCode,null,station("INMET",rio.ibgeCode)
            .copy(sourceUrl="https://apitempo.inmet.gov.br.evil.test/estacao/A652"))
        assertNull(RjHomeObservedEvidence.cityObservation(rio,
            mapOf(rio.ibgeCode to falseInmet),now))
        val falseRio=station("Alerta Rio",rio.ibgeCode)
            .copy(sourceUrl="https://websempre.rio.rj.gov.br.evil.test/estacoes/")
        assertEquals(0,RjHomeObservedEvidence.rioObservationCount(listOf(falseRio),now))
    }

    @Test fun rioNetworkIsOnlyAnActualRioNetworkAndNotAMunicipalAverage() {
        val rows=listOf(
            station("Alerta Rio",rio.ibgeCode),
            station("Alerta Rio",rio.ibgeCode,now.minusSeconds(3600)),
            station("Alerta Rio",niteroi.ibgeCode),
            station("INMET",rio.ibgeCode),
        )
        assertEquals(1,RjHomeObservedEvidence.rioObservationCount(rows,now))
    }

    @Test fun missingValuesStayUnavailableNotZero() {
        assertEquals("— °C",RjHomeObservedEvidence.celsius(null))
        assertEquals("— mm",RjHomeObservedEvidence.millimeters(null))
        assertTrue(RjHomeObservedEvidence.localTime(now).contains("13/11"))
    }
}
