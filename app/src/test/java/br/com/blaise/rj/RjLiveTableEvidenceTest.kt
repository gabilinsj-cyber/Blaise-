package br.com.blaise.rj

import br.com.blaise.rj.data.CityWeatherObservation
import br.com.blaise.rj.data.PublicRjMarine
import br.com.blaise.rj.data.PublicRjMarineWarning
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RjLiveTableEvidenceTest {
    private val now=Instant.parse("2026-10-13T03:00:00Z")
    private val stamp=Instant.parse("2026-10-13T02:50:00Z")

    private fun station(ibge: Int=3304557,source: String="INMET")=
        CityWeatherObservation(
            municipalityIbge=ibge,
            station="Estação A652",
            source=source,
            sourceUrl="https://apitempo.inmet.gov.br/estacao/A652",
            observedAt=stamp,
            temperatureC=31.0,
            humidityPercent=65.0,
            windKmh=17.0,
            maxAgeSeconds=3600,
            windGustKmh=32.0,
            hourlyRainMm=5.5,
        )

    @Test fun stationReadingHasTimestampAndNeverBecomesMunicipalAverage() {
        val value=RjLiveTableEvidence.municipality(
            "TEMPERATURA",3304557,station(),null,now)
        assertEquals("OBSERVACAO_PONTUAL",value.state)
        assertTrue(value.description.contains("31,0 °C"))
        assertEquals("INMET",value.source)
        assertEquals(stamp,value.observedAt)
        assertFalse(value.calculation)
        assertFalse(value.mayPublishAlert)
        val rain=RjLiveTableEvidence.municipality(
            "CHUVA_ATUAL",3304557,station(),null,now)
        assertTrue(rain.description.contains("última hora"))
        assertTrue(rain.description.contains("não comprova chuva neste instante"))
    }

    @Test fun neitherCrossMunicipalityNorStaleStationCanPopulateTables() {
        assertEquals("SEM_PRODUTO_VALIDADO",RjLiveTableEvidence.municipality(
            "TEMPERATURA",3303302,station(),null,now).state)
        assertEquals("SEM_PRODUTO_VALIDADO",RjLiveTableEvidence.municipality(
            "TEMPERATURA",3304557,station(source="Alerta Rio"),
            null,now.plusSeconds(7200)).state)
        assertEquals("SEM_PRODUTO_VALIDADO",RjLiveTableEvidence.municipality(
            "TEMPERATURA",3303302,station(3303302,"Alerta Rio"),null,now).state)
    }

    @Test fun heatIndexIsExplicitlyDerivedAndCannotIssueAlarm() {
        val r=RjLiveTableEvidence.municipality(
            "SENSACAO_TERMICA",3304557,station(),null,now)
        assertEquals("CALCULO_EXPERIMENTAL_BLAISE",r.state)
        assertTrue(r.description.contains("Rothfusz"))
        assertTrue(r.calculation)
        assertFalse(r.mayPublishAlert)
        val rules=RjLiveTableEvidence.calculationCriteria("TEMPERATURA")
        assertTrue(rules.contains("Σ(peso × medição)/Σ(pesos)"))
        assertTrue(RjLiveTableEvidence.calculationCriteria("TSUNAMI")
            .contains("Não calcular média"))
    }

    @Test fun officialMarineRegionalWarningNeverBecomesMunicipalRessacaPrediction() {
        val warning=PublicRjMarineWarning(
            id="321/2026",warningType="AVISO DE RESSACA",
            issuedAt=stamp,validUntil=now.plusSeconds(3600),areas=listOf("CHARLIE"),
            waveMinMeters=3.5,waveMaxMeters=4.2,waveDirection="SE",
            officialRessacaLabel=true)
        val marine=PublicRjMarine(stamp,
            "https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo",
            listOf(warning))
        val waves=RjLiveTableEvidence.marine("ONDAS",marine,now)
        assertEquals("AVISO_CHM_REGIONAL",waves.state)
        assertTrue(waves.description.contains("3,5 m"))
        assertTrue(waves.description.contains("METAREA V"))
        assertFalse(waves.mayPublishAlert)
        val ressaca=RjLiveTableEvidence.marine("RESSACA",marine,now)
        assertEquals("AVISO_CHM_REGIONAL",ressaca.state)
        val expired=RjLiveTableEvidence.marine("RESSACA",marine,now.plusSeconds(4_000))
        assertEquals("SEM_AVISO_MARITIMO_VALIDADO",expired.state)
    }

    @Test fun marineCatalogueConsultedWithoutApplicableWarningIsNotAConfirmedGreenPhenomenon() {
        val unrelated=PublicRjMarineWarning(
            id="444/2026",warningType="VENTO FORTE",
            issuedAt=stamp,validUntil=now.plusSeconds(3600),
            areas=listOf("CHARLIE"),
            waveMinMeters=null,waveMaxMeters=null,
            waveDirection=null,officialRessacaLabel=false,
        )
        val inventory=PublicRjMarine(stamp,
            "https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo",
            listOf(unrelated))
        val checked=RjLiveTableEvidence.marine("RESSACA",inventory,now)
        assertEquals("SEM_AVISO_APLICAVEL_CONFIRMADO",checked.state)
        assertEquals("Marinha / CHM",checked.source)
        assertFalse(RjLiveTableEvidence.hasConfirmedPhenomenon(checked))
        assertFalse(RjLiveTableEvidence.hasConfirmedPhenomenon(
            RjLiveTableEvidence.marine("ONDAS",null,now)))
        assertTrue(RjLiveTableEvidence.hasConfirmedPhenomenon(
            RjLiveTableEvidence.municipality("TEMPERATURA",3304557,station(),null,now)))
        assertFalse(checked.mayPublishAlert)
    }

    @Test fun marineWithoutSpecificProductIsUnavailableWithoutZeroOrSafetyClaim() {
        val noMarine=RjLiveTableEvidence.marine("ONDAS",null,now)
        assertEquals("SEM_AVISO_MARITIMO_VALIDADO",noMarine.state)
        assertTrue(noMarine.description.contains("não confirma mar seguro"))
        assertEquals("SEM_PRODUTO_VALIDADO",RjLiveTableEvidence.municipality(
            "TEMPERATURA_MAR",3304557,station(),null,now).state)
    }
}
