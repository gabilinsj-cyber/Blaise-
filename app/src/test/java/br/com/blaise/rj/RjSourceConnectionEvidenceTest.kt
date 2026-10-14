package br.com.blaise.rj

import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.data.CityWeatherObservation
import br.com.blaise.rj.data.PublicRjMarine
import br.com.blaise.rj.data.PublicRjMunicipality
import br.com.blaise.rj.data.PublicRjSourceProduct
import br.com.blaise.rj.data.PublicRjStatus
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RjSourceConnectionEvidenceTest {
    private val now=Instant.parse("2026-10-14T12:00:00Z")
    private val recently=now.minusSeconds(60)

    private fun station(ibge: Int, source: String)=CityWeatherObservation(
        municipalityIbge=ibge, station="Estação A652", source=source,
        sourceUrl=if(source=="Alerta Rio")
            "https://websempre.rio.rj.gov.br/estacoes/"
            else "https://apitempo.inmet.gov.br/estacao/A652",
        observedAt=recently, temperatureC=27.0,
        humidityPercent=68.0,windKmh=15.0,maxAgeSeconds=3600,
    )
    private fun public(status: String="CURRENT", stamp: Instant=now.minusSeconds(30)): PublicRjStatus {
        val towns=RioMunicipalities.all.map { city ->
            PublicRjMunicipality(city.ibgeCode,city.name,null,emptyList(),"UNAVAILABLE")
        }
        return PublicRjStatus(
            generatedAt=stamp, municipalities=towns, warnings=emptyList(),
            marine=PublicRjMarine(recently,
                "https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo",
                emptyList()),
            sourceProducts=listOf(
                PublicRjSourceProduct("inmet","INMET",status,"avisos",
                    "RJ_POR_COBERTURA_VALIDADA"),
                PublicRjSourceProduct("cemaden-rj","CEMADEN-RJ",status,
                    "risco-hidrologico","RJ_92_MUNICIPIOS"),
            ),
        )
    }

    @Test fun freshStationAndCHMConsultAreShownOnlyForTheirActualProducts() {
        val rows=RjSourceConnectionEvidence.rows(
            municipalityIbge=3304557,
            observation=station(3304557,"INMET"),
            rioStations=listOf(station(3304557,"Alerta Rio")),
            status=public(),now=now,
        )
        assertEquals(13,rows.size)
        assertTrue(rows.first { it.source=="Alerta Rio" }.verifiedCurrentProduct)
        assertTrue(rows.first { it.source=="INMET" && "Medição" in it.product }
            .verifiedCurrentProduct)
        assertTrue(rows.first { it.source=="INMET" && "CAP" in it.product }
            .verifiedCurrentProduct)
        val sea=rows.first { it.source=="Marinha do Brasil / CHM" }
        assertTrue(sea.verifiedCurrentProduct)
        assertEquals(recently,sea.updatedAt)
        assertTrue(sea.status.contains("não é previsão por praia"))
        assertFalse(rows.first { it.source=="OpenWeatherMap" }.verifiedCurrentProduct)
        assertFalse(rows.first { it.source=="Copernicus Marine" }.verifiedCurrentProduct)
        assertFalse(rows.first { it.source=="EUMETSAT" }.verifiedCurrentProduct)
        assertTrue(rows.first { it.source=="Defesa Civil RJ" }.status.contains("não é segunda medição"))
    }

    @Test fun aProviderNameCannotSpoofItsActualOfficialEndpoint() {
        val falseRio=station(3304557,"Alerta Rio")
            .copy(sourceUrl="https://websempre.rio.rj.gov.br.evil.test/estacoes/")
        val falseInmet=station(3304557,"INMET")
            .copy(sourceUrl="https://apitempo.inmet.gov.br.evil.test/estacao/A652")
        val rows=RjSourceConnectionEvidence.rows(
            municipalityIbge=3304557,observation=falseInmet,
            rioStations=listOf(falseRio),status=null,now=now,
        )
        assertFalse(rows.first { it.source=="Alerta Rio" }.verifiedCurrentProduct)
        assertFalse(rows.first { it.source=="INMET" && "Medição" in it.product }
            .verifiedCurrentProduct)
    }

    @Test fun stationFromRioMustNotBeAttributedToNiteroiOrAnyOtherMunicipality() {
        val rows=RjSourceConnectionEvidence.rows(
            municipalityIbge=3303302,
            observation=station(3304557,"INMET"),
            rioStations=listOf(station(3304557,"Alerta Rio")),
            status=public(),now=now,
        )
        assertFalse(rows.first { it.source=="Alerta Rio" }.verifiedCurrentProduct)
        assertTrue(rows.first { it.source=="Alerta Rio" }.status.contains("fora da cidade do Rio"))
        assertFalse(rows.first { it.source=="INMET" && "Medição" in it.product }
            .verifiedCurrentProduct)
        assertFalse(rows.first { it.source=="CEMADEN-RJ / Defesa Civil" }.verifiedCurrentProduct)
    }

    @Test fun expiredSnapshotsAndSourceStatesNeverAppearAsCurrent() {
        val staleProducts=RjSourceConnectionEvidence.rows(
            municipalityIbge=3304557,observation=null,
            status=public(status="STALE"),now=now)
        assertFalse(staleProducts.first { it.source=="INMET" && "CAP" in it.product }
            .verifiedCurrentProduct)
        // CHM inventory has its own freshness and is independent of INMET.
        assertTrue(staleProducts.first { it.source=="Marinha do Brasil / CHM" }
            .verifiedCurrentProduct)
        val stale=RjSourceConnectionEvidence.rows(
            municipalityIbge=3304557,observation=null,
            status=public(stamp=now.minusSeconds(300)),now=now)
        assertEquals(0,stale.count { it.verifiedCurrentProduct })
    }

    @Test fun unconnectedSourcesNeverClaimLiveCoverageOfAllRjMunicipalities() {
        for (city in RioMunicipalities.all) {
            val status=RjSourceConnectionEvidence.rows(
                municipalityIbge=city.ibgeCode,observation=null,
                status=null,now=now)
            assertEquals(0,status.count { it.verifiedCurrentProduct })
            assertEquals("Sem integração ao vivo comprovada",
                status.first { it.source=="NOAA" }.status)
        }
    }
}
