package br.com.blaise.rj.data

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class DashboardInternationalForecastTest {
    private val now = Instant.parse("2026-11-17T16:00:00Z")
    private fun model(): Map<String, Any?> = mapOf(
        "ibge" to "3304557",
        "sourceId" to "MET_NORWAY_LOCATIONFORECAST_2",
        "modelOrigin" to "ECMWF_IFS",
        "uvOrigin" to "COPERNICUS_CAMS_UV_VIA_MET_NO",
        "kind" to "MODEL_FORECAST_NOT_LOCAL_MEASUREMENT",
        "issuedAt" to "2026-11-17T15:10:00Z",
        "validAt" to "2026-11-17T15:00:00Z",
        "checkedAt" to "2026-11-17T15:59:50Z",
        "temperatureC" to 27.5, "feelsLikeC" to 29.0,
        "humidityPct" to 65.0, "pressureHpa" to 1010.0,
        "dewPointC" to 19.0, "cloudPct" to 45.0,
        "windKmh" to 13.4, "gustKmh" to 24.0,
        "uvClearSkyIndex" to 8.0, "precipitationNextHourMm" to 0.8,
        "precipitationProbabilityNextHourPct" to 30.0,
        "credit" to "MET Norway / ECMWF IFS (UV céu limpo: CAMS via MET Norway)",
        "sourceUrl" to "https://api.met.no/weatherapi/locationforecast/2.0/complete",
        "license" to "CC BY 4.0",
    )
    private fun base(rows: List<Map<String, Any?>>): Map<String, Any?> = mapOf(
        "contract" to DASHBOARD_DATA_CONTRACT,
        "generatedAt" to now.toString(),
        "mode" to "normal", "scope" to "RJ_APPROVED_SOURCES",
        "sourceCount" to 0, "currentSourceCount" to 0,
        "rainfall" to null, "sources" to emptyList<Map<String, Any?>>(),
        "privacy" to mapOf(
            "purchaseTokenExposed" to false,
            "rawStationPayloadExposed" to false,
            "userLocationStored" to false,
        ),
        "internationalForecasts" to rows,
    )

    @Test fun validModelIsParsedButNeverClaimsAnObservationOrAlert() {
        val snapshot = DashboardDataParser.parse(base(listOf(model())))
        assertEquals(1, snapshot.internationalForecasts.size)
        val forecast = snapshot.internationalForecasts.single()
        assertEquals(3304557, forecast.ibge)
        assertEquals(27.5, forecast.temperatureC!!, 1e-6)
        assertEquals(29.0, forecast.feelsLikeC!!, 1e-6)
        assertEquals("MET Norway / ECMWF IFS", forecast.sourceLabel)
        assertFalse(forecast.isOfficialObservation)
        assertFalse(forecast.mayCreateAlerts)
        assertTrue(snapshot.current(now))
        assertTrue(forecast.current(now))
        assertFalse(forecast.current(now.plusSeconds(180)))
    }

    @Test fun rejectsDomesticAndForgedOrExpiredModelRecords() {
        val bad = listOf(
            model() + ("sourceId" to "INMET"),
            model() + ("kind" to "OFFICIAL_STATION_OBSERVATION"),
            model() + ("credit" to "unknown"),
            model() + ("ibge" to "3309999"),
            model() + ("checkedAt" to "2026-11-17T15:45:00Z"),
            model() + ("temperatureC" to Double.NaN),
        )
        for (row in bad)
            assertThrows(IllegalArgumentException::class.java) {
                DashboardDataParser.parse(base(listOf(row)))
            }
    }

    @Test fun refusesDuplicateForecastMunicipalities() {
        assertThrows(IllegalArgumentException::class.java) {
            DashboardDataParser.parse(base(listOf(model(), model())))
        }
    }
}
