package br.com.blaise.rj.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class DashboardDataClientTest {
    @Test fun `display revalidates source time even when backend generated time is renewed`() {
        val snapshot = DashboardDataParser.parse(validPayload())
        assertTrue(snapshot.current(Instant.parse("2026-09-15T11:00:30Z")))
        val later = Instant.parse("2026-09-15T12:00:00Z")
        assertFalse(snapshot.copy(generatedAt = later).current(later))
        assertFalse(snapshot.current(Instant.parse("2026-09-15T11:03:00Z")))
        assertFalse(snapshot.current(Instant.parse("2026-09-15T10:58:00Z")))
    }

    @Test
    fun `dashboard endpoint is derived only from exact HTTPS entitlement verifier path`() {
        assertEquals(
            "https://api.example.test/v1/data/dashboard",
            DashboardDataEndpointPolicy.deriveFromEntitlementVerifier(
                "https://api.example.test/v1/entitlements/verify",
            ),
        )
        assertEquals(
            "https://api.example.test:8443/v1/data/dashboard",
            DashboardDataEndpointPolicy.deriveFromEntitlementVerifier(
                "https://api.example.test:8443/v1/entitlements/verify",
            ),
        )
        assertNull(DashboardDataEndpointPolicy.deriveFromEntitlementVerifier("http://api.example.test/v1/entitlements/verify"))
        assertNull(DashboardDataEndpointPolicy.deriveFromEntitlementVerifier("https://api.example.test/v1/entitlements/verify?debug=1"))
        assertNull(DashboardDataEndpointPolicy.deriveFromEntitlementVerifier("https://user@api.example.test/v1/entitlements/verify"))
        assertNull(DashboardDataEndpointPolicy.deriveFromEntitlementVerifier("https://api.example.test/v1/data/dashboard"))
    }

    @Test
    fun `parser accepts bounded official rainfall summary without raw station or token material`() {
        val snapshot = DashboardDataParser.parse(validPayload())

        assertEquals(Instant.parse("2026-09-15T11:00:00Z"), snapshot.generatedAt)
        assertEquals("normal", snapshot.mode)
        assertEquals(2, snapshot.sourceCount)
        assertEquals(1, snapshot.currentSourceCount)
        val rainfall = snapshot.rainfall ?: error("Expected validated legacy rainfall")
        assertEquals(33, rainfall.stationCount)
        assertEquals(2, rainfall.wetStationCount)
        assertEquals(12.5, rainfall.max15mMm!!, 0.0)
        assertEquals(28.4, rainfall.max1hMm!!, 0.0)
        assertEquals(85.7, rainfall.max24hMm!!, 0.0)
        assertEquals("CURRENT", snapshot.sources.first().state)
        assertEquals("STALE", snapshot.sources.last().state)
    }

    @Test
    fun `parser fails closed on contract drift privacy drift and impossible rainfall counts`() {
        val wrongContract = validPayload().toMutableMap().apply { put("contract", "OTHER") }
        assertTrue(runCatching { DashboardDataParser.parse(wrongContract) }.isFailure)

        val privacyDrift = validPayload().toMutableMap().apply {
            put("privacy", mapOf(
                "purchaseTokenExposed" to true,
                "rawStationPayloadExposed" to false,
                "userLocationStored" to false,
            ))
        }
        assertTrue(runCatching { DashboardDataParser.parse(privacyDrift) }.isFailure)

        val rainfallDrift = validPayload().toMutableMap().apply {
            val rainfall = (get("rainfall") as Map<*, *>).entries.associate { it.key as String to it.value }.toMutableMap()
            rainfall["wetStationCount"] = 34
            put("rainfall", rainfall)
        }
        assertTrue(runCatching { DashboardDataParser.parse(rainfallDrift) }.isFailure)
    }

    @Test
    fun `parser rejects mismatched current source count and duplicate source identities`() {
        val wrongCount = validPayload().toMutableMap().apply { put("currentSourceCount", 2) }
        assertTrue(runCatching { DashboardDataParser.parse(wrongCount) }.isFailure)

        val duplicateSources = validPayload().toMutableMap().apply {
            val source = (get("sources") as List<*>).first()
            put("sources", listOf(source, source))
            put("currentSourceCount", 2)
        }
        assertTrue(runCatching { DashboardDataParser.parse(duplicateSources) }.isFailure)
    }

    @Test fun `parser accepts new dashboard without excluded municipal gauge feed`() {
        val updated = validPayload().toMutableMap().apply {
            put("scope", "RJ_APPROVED_SOURCES")
            put("rainfall", null)
            put("rainfallAvailability", "UNAVAILABLE")
            put("sourceCount", 0)
            put("currentSourceCount", 0)
            put("sources", emptyList<Map<String, Any?>>())
            put("officialNoticeLinks", listOf(mapOf(
                "id" to "alerta-rio",
                "name" to "Alerta Rio",
                "message" to "Consulte os avisos oficiais de chuvas na cidade do Rio.",
                "url" to "https://www.sistema-alerta-rio.com.br/alertas/",
            )))
        }
        val snapshot = DashboardDataParser.parse(updated)
        assertNull(snapshot.rainfall)
        assertEquals(0, snapshot.currentSourceCount)
        assertEquals(1, snapshot.officialNoticeLinks.size)
        assertTrue(snapshot.current(Instant.parse("2026-09-15T11:00:10Z")))
        val invalid = updated.toMutableMap().apply { put("rainfallAvailability", "AVAILABLE") }
        assertTrue(runCatching { DashboardDataParser.parse(invalid) }.isFailure)
    }

    @Test fun `Visual Crossing aggregated current and next-hour forecast are distinct from station readings`() {
        val vc = validVc()
        val payload=validPayload().toMutableMap().apply {
            put("visualCrossingWeather",listOf(vc))
        }
        val snapshot=DashboardDataParser.parse(payload)
        val reading=snapshot.visualCrossingWeather.single()
        val now=Instant.parse("2026-09-15T11:00:00Z")
        assertEquals(3304557,reading.ibge)
        assertTrue(reading.current(now))
        assertTrue(reading.nextForecast(now))
        assertEquals(28.0,reading.temperatureC!!,0.0)
        assertEquals(70.0,reading.humidityPct!!,0.0)
        assertNull(reading.precipitationMm)
        assertEquals(1.2,reading.forecastPrecipitationMm!!,0.0)
        assertFalse(reading.isStationObservation)
        assertFalse(reading.mayCreateOfficialWarnings)
        assertEquals("Weather data by Visual Crossing",reading.attribution)
        assertFalse(reading.current(now.plusSeconds(1900)))
        assertFalse(reading.nextForecast(now.plusSeconds(4*3600)))
    }

    @Test fun `Visual Crossing client rejects expired values, invalid units, source drift and unsupported city`() {
        for(bad in listOf(
            validVc().toMutableMap().apply{put("sourceId","UNTRUSTED")},
            validVc().toMutableMap().apply{put("ibge","9999999")},
            validVc().toMutableMap().apply{put("attribution","Uncredited")},
            validVc().toMutableMap().apply{put("officialAlert",true)},
            validVc().toMutableMap().apply{put("currentValidAt","2026-09-15T10:00:00Z")},
            validVc().toMutableMap().apply{put("current",mapOf("temperatureC" to "28"))},
            validVc().toMutableMap().apply{
                put("current", (get("current") as Map<String,Any?>).toMutableMap().apply {
                    put("temperatureC",1000)
                })
            }
        )){
            val payload=validPayload().toMutableMap().apply{
                put("visualCrossingWeather",listOf(bad))
            }
            assertTrue(runCatching{DashboardDataParser.parse(payload)}.isFailure)
        }
    }

    private fun validVc(): Map<String,Any?> = mapOf(
        "contract" to "RJ_VISUAL_CROSSING_BOUNDED_CITY_E_P_V1",
        "ibge" to "3304557",
        "sourceId" to "VISUAL_CROSSING_FREE",
        "sourceLabel" to "Visual Crossing",
        "attribution" to "Weather data by Visual Crossing",
        "currentKind" to "E_AGGREGATED_NOT_STATION",
        "forecastKind" to "P_MODEL_NOT_OBSERVATION",
        "currentValidAt" to "2026-09-15T10:55:00Z",
        "checkedAt" to "2026-09-15T10:59:00Z",
        "officialAlert" to false,
        "dataNotForSafetyCriticalDecisions" to true,
        "current" to mapOf(
            "temperatureC" to 28.0,"feelsLikeC" to 31.0,
            "humidityPct" to 70.0,"dewPointC" to 21.0,
            "windKmh" to 12.0,"gustKmh" to null,
            "precipitationMm" to null,
            "precipitationProbabilityPct" to 30.0,
            "pressureHpa" to 1014.0,"severeRiskIndex" to null
        ),
        "forecastNext" to mapOf(
            "validAt" to "2026-09-15T11:50:00Z","kind" to "P",
            "precipitationMm" to 1.2,
            "precipitationProbabilityPct" to 70.0,"windGustKmh" to null
        )
    )

    private fun validPayload(): Map<String, Any?> = mapOf(
        "contract" to DASHBOARD_DATA_CONTRACT,
        "generatedAt" to "2026-09-15T11:00:00Z",
        "mode" to "normal",
        "scope" to "RJ_OFFICIAL_SOURCES_WITH_RIO_CITY_RAINFALL",
        "sourceCount" to 2,
        "currentSourceCount" to 1,
        "rainfall" to mapOf(
            "sourceId" to DASHBOARD_DATA_RAINFALL_SOURCE_ID,
            "coverage" to DASHBOARD_DATA_RAINFALL_COVERAGE,
            "state" to "CURRENT",
            "reason" to "fresh_snapshot",
            "observedAt" to "2026-09-15T10:59:00Z",
            "fetchedAt" to "2026-09-15T10:59:30Z",
            "stationCount" to 33,
            "wetStationCount" to 2,
            "missingValueCount" to 0,
            "max15mMm" to 12.5,
            "max1hMm" to 28.4,
            "max24hMm" to 85.7,
        ),
        "sources" to listOf(
            mapOf(
                "sourceId" to DASHBOARD_DATA_RAINFALL_SOURCE_ID,
                "state" to "CURRENT",
                "reason" to "fresh_snapshot",
                "fetchedAt" to "2026-09-15T10:59:30Z",
                "observedAt" to "2026-09-15T10:59:00Z",
                "dataAgeMs" to 60_000,
                "cacheAgeMs" to 30_000,
                "semanticValidity" to null,
            ),
            mapOf(
                "sourceId" to "chm-marine",
                "state" to "STALE",
                "reason" to "cache_age_exceeded",
                "fetchedAt" to "2026-09-15T09:00:00Z",
                "observedAt" to null,
                "dataAgeMs" to null,
                "cacheAgeMs" to 7_200_000,
                "semanticValidity" to "SOURCE_INVENTORY_TEMPORAL_VALIDITY_RJ_REGIONAL_ROUTED_NOT_MUNICIPAL_GEOFENCED",
            ),
        ),
        "privacy" to mapOf(
            "purchaseTokenExposed" to false,
            "rawStationPayloadExposed" to false,
            "userLocationStored" to false,
        ),
    )
}
