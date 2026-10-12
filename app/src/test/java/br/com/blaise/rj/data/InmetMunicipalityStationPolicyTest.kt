package br.com.blaise.rj.data

import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.core.City
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class InmetMunicipalityStationPolicyTest {
    private fun station(name: String, code: String = "A652",
        state: String = "RJ", provider: String = "INMET",
        status: String = "Operante", latitude: Double = -22.9,
        longitude: Double = -43.2,
    ) = InmetCatalogStation(
        code = code, name = name, state = state, provider = provider,
        operationalStatus = status, latitude = latitude, longitude = longitude,
    )

    private val rio = City("Rio de Janeiro", 3304557)
    private val niteroi = City("Niterói", 3303302)

    @Test fun rioAllowsNamedCityAndClearlyQualifiedRioStationsOnly() {
        val result = InmetMunicipalityStationPolicy.select(
            rio, listOf(station("RIO DE JANEIRO - FORTE DE COPACABANA", "A620"),
                station("RIO DE JANEIRO", "A652"),
                station("RIO DE JANEIRO / CENTRO", "A621"),
                station("NITERÓI", "A610")),
        )
        assertEquals(listOf("A652", "A620", "A621"), result.map { it.code })
    }

    @Test fun selectedNiteroiNeverBorrowRioOrAnotherCityStation() {
        val catalog = listOf(
            station("RIO DE JANEIRO"),
            station("NITERÓI", "A610"),
            station("SÃO GONÇALO", "A612"),
            station("NITERÓI / RIO", "A613"),
        )
        assertEquals(listOf("A610"), InmetMunicipalityStationPolicy.select(niteroi, catalog)
            .map { it.code })
        assertTrue(InmetMunicipalityStationPolicy.select(City("São Gonçalo", 3304904),
            listOf(station("SÃO JOÃO DE MERITI"))).isEmpty())
    }

    @Test fun stationMetadataMustBeOperationalOwnedByInmetAndInsideRjBounds() {
        val cases = listOf(
            station("NITERÓI", state = "SP"),
            station("NITERÓI", provider = "OTHER"),
            station("NITERÓI", status = "Desativada"),
            station("NITERÓI", code = "INVALID"),
            station("NITERÓI", latitude = Double.NaN),
            station("NITERÓI", longitude = -49.0),
            station("RIO DE JANEIRO", code = "A652"),
        )
        assertTrue(InmetMunicipalityStationPolicy.select(niteroi, cases).isEmpty())
    }

    @Test fun duplicateCodesCannotFabricateMoreStations() {
        val results = InmetMunicipalityStationPolicy.select(niteroi, listOf(
            station("NITERÓI", "A610"), station("NITERÓI", "A610"),
            station("NITERÓI", "A620"),
        ))
        assertEquals(listOf("A610", "A620"), results.map { it.code })
    }

    @Test fun allNinetyTwoRjCitiesHaveSelectableScopeWithoutClaimingLiveCoverage() {
        assertEquals(92, RioMunicipalities.all.size)
        for (city in RioMunicipalities.all) {
            assertTrue(InmetMunicipalityStationPolicy.select(city, emptyList()).isEmpty())
        }
        assertTrue(InmetMunicipalityStationPolicy.select(
            City("Rio de Janeiro", 4106902), listOf(station("RIO DE JANEIRO"))).isEmpty())
        assertTrue(InmetMunicipalityStationPolicy.select(
            City("Wrong name", 3304557), listOf(station("RIO DE JANEIRO"))).isEmpty())
    }
}
