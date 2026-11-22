package br.com.blaise.rj

import br.com.blaise.rj.data.DashboardWeatherApiCurrentParser
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class DashboardWeatherApiCurrentTest {
    private val now=Instant.parse("2026-11-22T15:00:00Z")
    private fun row()=mapOf<String,Any?>(
        "contract" to "RJ_WEATHERAPI_FREE_CURRENT_E_V1",
        "ibge" to "3304557",
        "sourceId" to "WEATHERAPI_FREE",
        "sourceLabel" to "WeatherAPI.com",
        "attribution" to "Dados meteorológicos: WeatherAPI.com",
        "nature" to "E_AGGREGATED_NOT_STATION",
        "validAt" to "2026-11-22T14:40:00Z",
        "checkedAt" to "2026-11-22T14:59:00Z",
        "temperatureC" to 29.3,
        "feelsLikeC" to 32.1,
        "humidityPct" to 74.0,
        "windKmh" to 16.2,
        "gustKmh" to 27.0,
        "precipitationMm" to 1.2,
        "cloudPct" to 42.0,
        "pressureHpa" to 1009.0,
        "uvIndex" to 5.0,
        "skyCondition" to "PARCIALMENTE_NUBLADO",
        "officialAlert" to false,
        "actualStormConfirmed" to false,
        "criticalAlertEscalationAuthorized" to false
    )
    @Test fun correctlyDisplaysBoundedEValuesAndOriginalProviderAge() {
        val w=DashboardWeatherApiCurrentParser.parse(row(),now)
        assertEquals(29.3,w.temperatureC!!,0.001)
        assertEquals(32.1,w.feelsLikeC!!,0.001)
        assertEquals("PARCIALMENTE_NUBLADO",w.skyCondition)
        assertEquals(42.0,w.cloudPct!!,0.001)
        assertEquals(1.2,w.precipitationMm!!,0.001)
        assertTrue(w.current(now))
        assertFalse(w.current(now.plusSeconds(1000)))
        assertFalse(w.isStationObservation)
        assertFalse(w.mayIssueCriticalAlerts)
    }
    @Test fun rejectsWrongCitySourceAgeSecretOrActiveSafetyAlert() {
        val invalid=listOf(
            row()+("ibge" to "9999999"),
            row()+("sourceId" to "INMET"),
            row()+("validAt" to "2026-11-22T14:00:00Z"),
            row()+("checkedAt" to "2026-11-22T14:30:00Z"),
            row()+("actualStormConfirmed" to true),
            row()+("temperatureC" to 9999.0),
            row()+("apikey" to "must-never-be-here")
        )
        for(raw in invalid)assertTrue(runCatching {
            DashboardWeatherApiCurrentParser.parse(raw,now)
        }.isFailure)
    }
}
