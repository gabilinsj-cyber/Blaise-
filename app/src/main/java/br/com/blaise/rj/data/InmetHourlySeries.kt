package br.com.blaise.rj.data

import java.time.Duration
import java.time.Instant

/**
 * Public INMET automatic-station readings, not a city mean, forecast or radar.
 * Automatic-station raw values require local range, timestamp and age checks.
 */
enum class InmetMetric { TEMPERATURE, HOURLY_RAINFALL, WIND }

data class InmetHourlyPoint(
    val observedAt: Instant,
    val temperatureC: Double?,
    val rainfallMm: Double?,
    val windKmh: Double?,
) {
    fun reading(metric: InmetMetric): Double? = when (metric) {
        InmetMetric.TEMPERATURE -> temperatureC?.takeIf { it.isFinite() && it in -30.0..60.0 }
        InmetMetric.HOURLY_RAINFALL -> rainfallMm?.takeIf { it.isFinite() && it in 0.0..400.0 }
        InmetMetric.WIND -> windKmh?.takeIf { it.isFinite() && it in 0.0..360.0 }
    }
}

data class InmetHourlySeries(
    val stationCode: String,
    val stationName: String,
    val sourceUrl: String,
    val latitude: Double,
    val longitude: Double,
    val points: List<InmetHourlyPoint>,
) {
    private fun trustedMetadata(): Boolean =
        Regex("[A-Z][0-9]{3}").matches(stationCode) &&
            stationName.isNotBlank() && stationName.length <= 100 &&
            sourceUrl.startsWith("https://apitempo.inmet.gov.br/estacao/") &&
            sourceUrl.endsWith("/$stationCode") &&
            latitude.isFinite() && latitude in -23.6..-20.4 &&
            longitude.isFinite() && longitude in -45.3..-40.6 &&
            points.size in 1..48 &&
            points.map { it.observedAt }.distinct().size == points.size

    private fun elapsedSeconds(point: InmetHourlyPoint, now: Instant): Long =
        Duration.between(point.observedAt, now).seconds

    fun currentPoint(metric: InmetMetric, now: Instant): Pair<InmetHourlyPoint, Double>? {
        if (!trustedMetadata()) return null
        return points.asSequence()
            .filter { elapsedSeconds(it, now) in 0..7200 }
            .mapNotNull { point -> point.reading(metric)?.let { point to it } }
            .maxByOrNull { it.first.observedAt }
    }

    /** Only real hourly readings within the last 24h. A line needs >=2 points
     * and a recent last observation; otherwise no line is painted. */
    fun recentPoints(metric: InmetMetric, now: Instant): List<Pair<InmetHourlyPoint, Double>> {
        if (currentPoint(metric, now) == null) return emptyList()
        val records = points.asSequence()
            .filter { elapsedSeconds(it, now) in 0..86_400 }
            .mapNotNull { point -> point.reading(metric)?.let { point to it } }
            .sortedBy { it.first.observedAt }
            .toList()
        return if (records.size >= 2) records else emptyList()
    }
}
