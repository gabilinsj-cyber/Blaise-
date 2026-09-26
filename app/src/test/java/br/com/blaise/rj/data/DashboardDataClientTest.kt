package br.com.blaise.rj.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class DashboardDataClientTest {
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
        val snapshot = DashboardDataParser.parse(validPayload(), Instant.parse("2026-09-15T11:00:30Z"))

        assertEquals(Instant.parse("2026-09-15T11:00:00Z"), snapshot.generatedAt)
        assertEquals("normal", snapshot.mode)
        assertEquals(2, snapshot.sourceCount)
        assertEquals(1, snapshot.currentSourceCount)
        assertEquals(33, snapshot.rainfall.stationCount)
        assertEquals(2, snapshot.rainfall.wetStationCount)
        assertEquals(12.5, snapshot.rainfall.max15mMm!!, 0.0)
        assertEquals(28.4, snapshot.rainfall.max1hMm!!, 0.0)
        assertEquals(85.7, snapshot.rainfall.max24hMm!!, 0.0)
        assertEquals("CURRENT", snapshot.sources.first().state)
        assertEquals("STALE", snapshot.sources.last().state)
    }

    @Test
    fun `parser fails closed on contract drift privacy drift and impossible rainfall counts`() {
        val wrongContract = validPayload().toMutableMap().apply { put("contract", "OTHER") }
        assertTrue(runCatching { DashboardDataParser.parse(wrongContract, Instant.parse("2026-09-15T11:00:30Z")) }.isFailure)

        val privacyDrift = validPayload().toMutableMap().apply {
            put("privacy", mapOf(
                "purchaseTokenExposed" to true,
                "rawStationPayloadExposed" to false,
                "userLocationStored" to false,
            ))
        }
        assertTrue(runCatching { DashboardDataParser.parse(privacyDrift, Instant.parse("2026-09-15T11:00:30Z")) }.isFailure)

        val rainfallDrift = validPayload().toMutableMap().apply {
            val rainfall = (get("rainfall") as Map<*, *>).entries.associate { it.key as String to it.value }.toMutableMap()
            rainfall["wetStationCount"] = 34
            put("rainfall", rainfall)
        }
        assertTrue(runCatching { DashboardDataParser.parse(rainfallDrift, Instant.parse("2026-09-15T11:00:30Z")) }.isFailure)
    }

    @Test
    fun `parser rejects mismatched current source count and duplicate source identities`() {
        val wrongCount = validPayload().toMutableMap().apply { put("currentSourceCount", 2) }
        assertTrue(runCatching { DashboardDataParser.parse(wrongCount, Instant.parse("2026-09-15T11:00:30Z")) }.isFailure)

        val duplicateSources = validPayload().toMutableMap().apply {
            val source = (get("sources") as List<*>).first()
            put("sources", listOf(source, source))
            put("currentSourceCount", 2)
        }
        assertTrue(runCatching { DashboardDataParser.parse(duplicateSources, Instant.parse("2026-09-15T11:00:30Z")) }.isFailure)
    }


    @Test
    fun `parser fails closed on future generated rainfall and source timestamps`() {
        val now = Instant.parse("2026-09-15T11:00:30Z")

        val futureGenerated = validPayload().toMutableMap().apply {
            put("generatedAt", "2026-09-15T11:03:00Z")
        }
        assertTrue(runCatching { DashboardDataParser.parse(futureGenerated, now) }.isFailure)

        val futureRainfall = validPayload().toMutableMap().apply {
            val rainfall = (get("rainfall") as Map<*, *>).entries.associate { it.key as String to it.value }.toMutableMap()
            rainfall["observedAt"] = "2026-09-15T11:03:00Z"
            put("rainfall", rainfall)
        }
        assertTrue(runCatching { DashboardDataParser.parse(futureRainfall, now) }.isFailure)

        val futureSource = validPayload().toMutableMap().apply {
            val sources = (get("sources") as List<*>).map { raw ->
                (raw as Map<*, *>).entries.associate { it.key as String to it.value }.toMutableMap()
            }
            sources[0]["fetchedAt"] = "2026-09-15T11:03:00Z"
            put("sources", sources)
        }
        assertTrue(runCatching { DashboardDataParser.parse(futureSource, now) }.isFailure)
    }

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
