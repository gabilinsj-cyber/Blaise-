package br.com.blaise.rj

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.unit.dp
import br.com.blaise.rj.data.CityWeatherResult
import br.com.blaise.rj.data.InmetMetric
import java.time.Instant
import java.util.Locale
import kotlin.math.min

/**
 * One dot per ACTUAL official INMET station, at catalog coordinates.
 * Only previously fetched, fresh, exact-municipality observations enter this
 * layer. It never creates radar pixels, city averages, or interpolated fields.
 */
internal data class RjOfficialPoint(
    val station: String,
    val sourceUrl: String,
    val latitude: Double,
    val longitude: Double,
    val observedAt: Instant,
    val measuredValue: Double,
    val unit: String,
)

internal object RjMunicipalPointPolicy {
    fun points(
        reports: Map<Int, CityWeatherResult>,
        now: Instant,
        metric: InmetMetric,
        excludeSourceUrl: String? = null,
    ): List<RjOfficialPoint> = reports.values.asSequence()
        .mapNotNull { report -> report.currentObservation(now) }
        .filter { observation ->
            observation.source == "INMET" &&
                observation.sourceUrl.startsWith("https://apitempo.inmet.gov.br/estacao/") &&
                observation.stationLatitude != null && observation.stationLongitude != null
        }
        .mapNotNull { observation ->
            val value = when (metric) {
                InmetMetric.TEMPERATURE -> observation.temperatureC
                InmetMetric.HOURLY_RAINFALL -> observation.hourlyRainMm
                InmetMetric.WIND -> observation.windKmh
            } ?: return@mapNotNull null
            val bounds = when (metric) {
                InmetMetric.TEMPERATURE -> -30.0..60.0
                InmetMetric.HOURLY_RAINFALL -> 0.0..400.0
                InmetMetric.WIND -> 0.0..360.0
            }
            if (!value.isFinite() || value !in bounds ||
                observation.sourceUrl == excludeSourceUrl) return@mapNotNull null
            RjOfficialPoint(
                observation.station, observation.sourceUrl,
                observation.stationLatitude!!, observation.stationLongitude!!,
                observation.observedAt, value,
                when (metric) {
                    InmetMetric.TEMPERATURE -> "°C"
                    InmetMetric.HOURLY_RAINFALL -> "mm (1h)"
                    InmetMetric.WIND -> "km/h"
                },
            )
        }
        .distinctBy { it.sourceUrl }
        // Only requested city cards (plus Rio if selected) are polled; this is
        // NOT a claimed 92-city sensor network.
        .take(3).toList()
}

@Composable
internal fun RjMunicipalStationMapOverlay(
    reports: Map<Int, CityWeatherResult>,
    metric: InmetMetric,
    now: Instant,
    modifier: Modifier = Modifier,
    zoom: Float = 1f,
    excludeSourceUrl: String? = null,
) {
    val observations = RjMunicipalPointPolicy.points(
        reports, now, metric, excludeSourceUrl,
    )
    if (observations.isEmpty()) return
    Canvas(modifier.fillMaxSize()) {
        val west = RioMunicipalityGeometry.WEST
        val east = RioMunicipalityGeometry.EAST
        val south = RioMunicipalityGeometry.SOUTH
        val north = RioMunicipalityGeometry.NORTH
        val scale = min(size.width / (east - west), size.height / (north - south)) *
            0.88f * zoom
        val left = (size.width - (east - west) * scale) / 2f
        val top = (size.height - (north - south) * scale) / 2f
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.WHITE
            textSize = 10.dp.toPx()
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            setShadowLayer(3.dp.toPx(), 1f, 1f, android.graphics.Color.BLACK)
        }
        val dotColor = when (metric) {
            InmetMetric.TEMPERATURE -> Color(0xFFFFC857)
            InmetMetric.HOURLY_RAINFALL -> Color(0xFF58B9FF)
            InmetMetric.WIND -> Color(0xFF57E389)
        }
        observations.forEach { point ->
            val xy = Offset(
                left + (point.longitude.toFloat() - west) * scale,
                top + (north - point.latitude.toFloat()) * scale,
            )
            if (xy.x in 10f..(size.width - 10f) &&
                xy.y in 10f..(size.height - 10f)) {
                drawCircle(Color(0xD9091D31), radius = 12.dp.toPx(), center = xy)
                drawCircle(dotColor, radius = 7.dp.toPx(), center = xy)
                drawCircle(Color.White, radius = 7.dp.toPx(), center = xy,
                    style = Stroke(width = 1.dp.toPx()))
                val label = String.format(Locale("pt", "BR"),
                    "%.1f %s", point.measuredValue, point.unit)
                val width = paint.measureText(label)
                val start = xy.x + 13.dp.toPx()
                val textX = if (start + width < size.width - 4.dp.toPx()) start
                    else (xy.x - width - 13.dp.toPx()).coerceAtLeast(4.dp.toPx())
                drawContext.canvas.nativeCanvas.drawText(label, textX,
                    xy.y - 5.dp.toPx(), paint)
            }
        }
    }
}
