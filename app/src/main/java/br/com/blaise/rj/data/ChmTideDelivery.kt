package br.com.blaise.rj.data

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneOffset

const val CHM_TIDE_DELIVERY_CONTRACT = "OFFICIAL_CHM_TIDE_VALUES_DELIVERY_V1"
const val CHM_TIDE_SOURCE_ID = "chm-marine"
const val CHM_TIDE_TIME_BASIS = "LEGAL_LOCAL_TIME_FROM_CHM_TABLE_HEADER"
const val CHM_TIDE_MAX_VERIFICATION_AGE_MS = 24L * 60L * 60L * 1000L

class ChmTideDeliveryException(message: String) : IllegalArgumentException(message)

data class ChmTideStation(
    val stationNumber: Int,
    val name: String,
    val pageStart: Int,
    val pageEnd: Int,
)

data class ChmTidePrediction(
    val localDate: String,
    val localTime: String,
    val instantUtc: String,
    val heightMeters: Double,
    val phase: String?,
    val sourcePage: Int,
)

data class ChmTideSnapshot(
    val station: ChmTideStation,
    val calendarYear: Int,
    val timeBasis: String,
    val utcOffsetMinutes: Int,
    val sourceArtifactSha256: String,
    val tideValueSha256: String,
    val predictionCount: Int,
    val predictions: List<ChmTidePrediction>,
)

data class ChmTideDelivery(
    val contract: String,
    val sourceId: String,
    val stationNumber: Int,
    val calendarYear: Int,
    val state: String,
    val fetchedAt: String,
    val verificationAgeMs: Long,
    val lastErrorCode: String?,
    val snapshot: ChmTideSnapshot,
)

object ChmTideDeliveryParser {
    private val sha256 = Regex("^[0-9a-f]{64}$")
    private val errorCode = Regex("^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$")

    fun parse(
        payload: Map<String, Any?>,
        expectedStationNumber: Int? = null,
        expectedCalendarYear: Int? = null,
    ): ChmTideDelivery {
        requireExactKeys(
            payload,
            setOf(
                "contract", "sourceId", "stationNumber", "calendarYear", "state",
                "fetchedAt", "verificationAgeMs", "lastErrorCode", "snapshot",
            ),
            "chm_tide_delivery_top_level_shape_invalid",
        )
        val contract = string(payload, "contract")
        if (contract != CHM_TIDE_DELIVERY_CONTRACT) fail("chm_tide_delivery_contract_invalid")
        val sourceId = string(payload, "sourceId")
        if (sourceId != CHM_TIDE_SOURCE_ID) fail("chm_tide_delivery_source_invalid")

        val stationNumber = int(payload, "stationNumber", 1, 99)
        val calendarYear = int(payload, "calendarYear", 2020, 2100)
        if (expectedStationNumber != null && stationNumber != expectedStationNumber) {
            fail("chm_tide_delivery_station_mismatch")
        }
        if (expectedCalendarYear != null && calendarYear != expectedCalendarYear) {
            fail("chm_tide_delivery_year_mismatch")
        }

        val state = string(payload, "state")
        if (state != "CURRENT" && state != "CURRENT_DEGRADED") {
            fail("chm_tide_delivery_state_not_current")
        }
        val fetchedAt = string(payload, "fetchedAt")
        parseInstant(fetchedAt, "chm_tide_delivery_fetched_at_invalid")
        val verificationAgeMs = long(payload, "verificationAgeMs", 0L, CHM_TIDE_MAX_VERIFICATION_AGE_MS)
        val lastErrorCode = payload["lastErrorCode"]?.let {
            val value = it as? String ?: fail("chm_tide_delivery_error_code_invalid")
            if (!errorCode.matches(value)) fail("chm_tide_delivery_error_code_invalid")
            value
        }
        if (state == "CURRENT" && lastErrorCode != null) fail("chm_tide_delivery_current_error_conflict")
        if (state == "CURRENT_DEGRADED" && lastErrorCode == null) fail("chm_tide_delivery_degraded_error_missing")

        val snapshotMap = map(payload, "snapshot")
        requireExactKeys(
            snapshotMap,
            setOf(
                "station", "calendarYear", "timeBasis", "utcOffsetMinutes",
                "sourceArtifactSha256", "tideValueSha256", "predictionCount", "predictions",
            ),
            "chm_tide_delivery_snapshot_shape_invalid",
        )
        val snapshotYear = int(snapshotMap, "calendarYear", 2020, 2100)
        if (snapshotYear != calendarYear) fail("chm_tide_delivery_snapshot_year_mismatch")
        val timeBasis = string(snapshotMap, "timeBasis")
        if (timeBasis != CHM_TIDE_TIME_BASIS) fail("chm_tide_delivery_time_basis_invalid")
        val utcOffsetMinutes = int(snapshotMap, "utcOffsetMinutes", -720, 840)
        val sourceArtifactSha256 = digest(snapshotMap, "sourceArtifactSha256")
        val tideValueSha256 = digest(snapshotMap, "tideValueSha256")

        val stationMap = map(snapshotMap, "station")
        requireExactKeys(
            stationMap,
            setOf("stationNumber", "name", "pageStart", "pageEnd"),
            "chm_tide_delivery_station_shape_invalid",
        )
        val snapshotStationNumber = int(stationMap, "stationNumber", 1, 99)
        if (snapshotStationNumber != stationNumber) fail("chm_tide_delivery_snapshot_station_mismatch")
        val stationName = string(stationMap, "name").replace(Regex("\\s+"), " ").trim()
        if (stationName.length !in 3..120) fail("chm_tide_delivery_station_name_invalid")
        val pageStart = int(stationMap, "pageStart", 1, 400)
        val pageEnd = int(stationMap, "pageEnd", 1, 400)
        if (pageEnd - pageStart != 2) fail("chm_tide_delivery_page_range_invalid")
        val station = ChmTideStation(snapshotStationNumber, stationName, pageStart, pageEnd)

        val predictionCount = int(snapshotMap, "predictionCount", 1, 366 * 8)
        val predictionValues = snapshotMap["predictions"] as? List<*>
            ?: fail("chm_tide_delivery_predictions_invalid")
        if (predictionValues.size != predictionCount) fail("chm_tide_delivery_prediction_count_mismatch")
        val predictions = predictionValues.mapIndexed { index, raw ->
            parsePrediction(raw, index, calendarYear, utcOffsetMinutes, station)
        }
        for (index in 1 until predictions.size) {
            val previous = predictions[index - 1]
            val current = predictions[index]
            if (previous.instantUtc >= current.instantUtc) fail("chm_tide_delivery_prediction_order_invalid")
        }

        return ChmTideDelivery(
            contract = contract,
            sourceId = sourceId,
            stationNumber = stationNumber,
            calendarYear = calendarYear,
            state = state,
            fetchedAt = fetchedAt,
            verificationAgeMs = verificationAgeMs,
            lastErrorCode = lastErrorCode,
            snapshot = ChmTideSnapshot(
                station = station,
                calendarYear = snapshotYear,
                timeBasis = timeBasis,
                utcOffsetMinutes = utcOffsetMinutes,
                sourceArtifactSha256 = sourceArtifactSha256,
                tideValueSha256 = tideValueSha256,
                predictionCount = predictionCount,
                predictions = predictions,
            ),
        )
    }

    private fun parsePrediction(
        raw: Any?,
        index: Int,
        calendarYear: Int,
        utcOffsetMinutes: Int,
        station: ChmTideStation,
    ): ChmTidePrediction {
        val value = raw as? Map<*, *> ?: fail("chm_tide_delivery_prediction_invalid_$index")
        val map = stringKeyMap(value, "chm_tide_delivery_prediction_invalid_$index")
        requireExactKeys(
            map,
            setOf("localDate", "localTime", "instantUtc", "heightMeters", "phase", "sourcePage"),
            "chm_tide_delivery_prediction_shape_invalid",
        )
        val localDateRaw = string(map, "localDate")
        val localTimeRaw = string(map, "localTime")
        val localDate = try { LocalDate.parse(localDateRaw) } catch (_: Exception) {
            fail("chm_tide_delivery_local_date_invalid")
        }
        val localTime = try { LocalTime.parse(localTimeRaw) } catch (_: Exception) {
            fail("chm_tide_delivery_local_time_invalid")
        }
        if (localDate.year != calendarYear) fail("chm_tide_delivery_local_year_mismatch")
        val instantUtc = string(map, "instantUtc")
        val parsedInstant = parseInstant(instantUtc, "chm_tide_delivery_instant_invalid")
        val expectedInstant = LocalDateTime.of(localDate, localTime)
            .toInstant(ZoneOffset.ofTotalSeconds(utcOffsetMinutes * 60))
        if (parsedInstant != expectedInstant) fail("chm_tide_delivery_instant_mismatch")
        val height = double(map, "heightMeters", -10.0, 20.0)
        val phase = map["phase"]?.let {
            val token = it as? String ?: fail("chm_tide_delivery_phase_invalid")
            if (token != "HIGH" && token != "LOW") fail("chm_tide_delivery_phase_invalid")
            token
        }
        val sourcePage = int(map, "sourcePage", station.pageStart, station.pageEnd)
        return ChmTidePrediction(localDateRaw, localTimeRaw, instantUtc, height, phase, sourcePage)
    }

    private fun map(map: Map<String, Any?>, key: String): Map<String, Any?> {
        val raw = map[key] as? Map<*, *> ?: fail("chm_tide_delivery_${key}_invalid")
        return stringKeyMap(raw, "chm_tide_delivery_${key}_invalid")
    }

    private fun stringKeyMap(raw: Map<*, *>, code: String): Map<String, Any?> {
        if (raw.keys.any { it !is String }) fail(code)
        @Suppress("UNCHECKED_CAST")
        return raw as Map<String, Any?>
    }

    private fun string(map: Map<String, Any?>, key: String): String {
        val value = map[key] as? String ?: fail("chm_tide_delivery_${key}_invalid")
        if (value.isBlank() || value.length > 160 || value.any { it.code < 0x20 || it.code == 0x7f }) {
            fail("chm_tide_delivery_${key}_invalid")
        }
        return value
    }

    private fun digest(map: Map<String, Any?>, key: String): String {
        val value = string(map, key)
        if (!sha256.matches(value)) fail("chm_tide_delivery_${key}_invalid")
        return value
    }

    private fun int(map: Map<String, Any?>, key: String, min: Int, max: Int): Int {
        val number = map[key] as? Number ?: fail("chm_tide_delivery_${key}_invalid")
        val value = number.toDouble()
        if (!value.isFinite() || value % 1.0 != 0.0 || value < min || value > max) {
            fail("chm_tide_delivery_${key}_invalid")
        }
        return value.toInt()
    }

    private fun long(map: Map<String, Any?>, key: String, min: Long, max: Long): Long {
        val number = map[key] as? Number ?: fail("chm_tide_delivery_${key}_invalid")
        val value = number.toDouble()
        if (!value.isFinite() || value % 1.0 != 0.0 || value < min.toDouble() || value > max.toDouble()) {
            fail("chm_tide_delivery_${key}_invalid")
        }
        return value.toLong()
    }

    private fun double(map: Map<String, Any?>, key: String, min: Double, max: Double): Double {
        val value = (map[key] as? Number)?.toDouble() ?: fail("chm_tide_delivery_${key}_invalid")
        if (!value.isFinite() || value < min || value > max) fail("chm_tide_delivery_${key}_invalid")
        return value
    }

    private fun parseInstant(value: String, code: String): Instant = try {
        Instant.parse(value)
    } catch (_: Exception) {
        fail(code)
    }

    private fun requireExactKeys(map: Map<String, Any?>, allowed: Set<String>, code: String) {
        if (map.keys != allowed) fail(code)
    }

    private fun fail(code: String): Nothing = throw ChmTideDeliveryException(code)
}
