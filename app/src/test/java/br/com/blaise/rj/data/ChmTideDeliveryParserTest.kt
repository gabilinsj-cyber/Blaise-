package br.com.blaise.rj.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ChmTideDeliveryParserTest {
    private fun payload(): MutableMap<String, Any?> = mutableMapOf(
        "contract" to CHM_TIDE_DELIVERY_CONTRACT,
        "sourceId" to CHM_TIDE_SOURCE_ID,
        "stationNumber" to 40,
        "calendarYear" to 2026,
        "state" to "CURRENT",
        "fetchedAt" to "2026-09-14T18:00:00.000Z",
        "verificationAgeMs" to 120_000L,
        "lastErrorCode" to null,
        "snapshot" to mutableMapOf<String, Any?>(
            "station" to mutableMapOf<String, Any?>(
                "stationNumber" to 40,
                "name" to "PORTO DO RIO DE JANEIRO - I FISCAL",
                "pageStart" to 130,
                "pageEnd" to 132,
            ),
            "calendarYear" to 2026,
            "timeBasis" to CHM_TIDE_TIME_BASIS,
            "utcOffsetMinutes" to -180,
            "sourceArtifactSha256" to "a".repeat(64),
            "tideValueSha256" to "b".repeat(64),
            "predictionCount" to 2,
            "predictions" to mutableListOf<Any?>(
                mutableMapOf<String, Any?>(
                    "localDate" to "2026-09-14",
                    "localTime" to "03:12",
                    "instantUtc" to "2026-09-14T06:12:00Z",
                    "heightMeters" to 0.3,
                    "phase" to "LOW",
                    "sourcePage" to 130,
                ),
                mutableMapOf<String, Any?>(
                    "localDate" to "2026-09-14",
                    "localTime" to "09:28",
                    "instantUtc" to "2026-09-14T12:28:00Z",
                    "heightMeters" to 1.2,
                    "phase" to "HIGH",
                    "sourcePage" to 130,
                ),
            ),
        ),
    )

    @Test
    fun acceptsCurrentBackendContractAndValidatesUtcBinding() {
        val result = ChmTideDeliveryParser.parse(
            payload(),
            expectedStationNumber = 40,
            expectedCalendarYear = 2026,
        )

        assertEquals("CURRENT", result.state)
        assertEquals(40, result.snapshot.station.stationNumber)
        assertEquals(-180, result.snapshot.utcOffsetMinutes)
        assertEquals(2, result.snapshot.predictionCount)
        assertEquals("2026-09-14T06:12:00Z", result.snapshot.predictions.first().instantUtc)
        assertNull(result.lastErrorCode)
    }

    @Test
    fun acceptsCurrentDegradedOnlyWithBoundedErrorCode() {
        val payload = payload()
        payload["state"] = "CURRENT_DEGRADED"
        payload["lastErrorCode"] = "chm_source_refresh_failed"
        val result = ChmTideDeliveryParser.parse(payload)
        assertEquals("CURRENT_DEGRADED", result.state)
        assertEquals("chm_source_refresh_failed", result.lastErrorCode)
    }

    @Test
    fun rejectsStaleOrUnavailableStateFailClosed() {
        val payload = payload()
        payload["state"] = "STALE"
        assertFailure("chm_tide_delivery_state_not_current") {
            ChmTideDeliveryParser.parse(payload)
        }
    }

    @Test
    fun rejectsUtcInstantThatDoesNotMatchOfficialLocalClockOffset() {
        val payload = payload()
        @Suppress("UNCHECKED_CAST")
        val snapshot = payload["snapshot"] as MutableMap<String, Any?>
        @Suppress("UNCHECKED_CAST")
        val predictions = snapshot["predictions"] as MutableList<Any?>
        @Suppress("UNCHECKED_CAST")
        val first = predictions.first() as MutableMap<String, Any?>
        first["instantUtc"] = "2026-09-14T05:12:00Z"

        assertFailure("chm_tide_delivery_instant_mismatch") {
            ChmTideDeliveryParser.parse(payload)
        }
    }

    @Test
    fun rejectsUnknownFieldsRatherThanSilentlyTrustingContractDrift() {
        val payload = payload()
        payload["rawPdf"] = "forbidden"
        assertFailure("chm_tide_delivery_top_level_shape_invalid") {
            ChmTideDeliveryParser.parse(payload)
        }
    }

    private fun assertFailure(expected: String, block: () -> Unit) {
        var failure: Throwable? = null
        try {
            block()
        } catch (error: Throwable) {
            failure = error
        }
        assertTrue("expected ChmTideDeliveryException", failure is ChmTideDeliveryException)
        assertEquals(expected, failure?.message)
    }
}
