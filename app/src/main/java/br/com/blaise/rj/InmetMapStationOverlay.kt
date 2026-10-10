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
import br.com.blaise.rj.data.InmetHourlySeries
import br.com.blaise.rj.data.InmetMetric
import java.time.Instant
import kotlin.math.min

/**
 * Single official INMET station, drawn at its catalog coordinates using the
 * SAME transform as RioGeographicBase. This is a point, NEVER synthetic radar
 * reflectivity, city coverage, weather prediction or interpolated raster.
 */
@Composable
internal fun InmetMapStationOverlay(
    metric: InmetMetric,
    series: InmetHourlySeries?,
    now: Instant,
    modifier: Modifier = Modifier,
    zoom: Float = 1f,
) {
    val current = series?.currentPoint(metric, now) ?: return
    Canvas(modifier.fillMaxSize()) {
        val west = RioMunicipalityGeometry.WEST
        val east = RioMunicipalityGeometry.EAST
        val south = RioMunicipalityGeometry.SOUTH
        val north = RioMunicipalityGeometry.NORTH
        val scale = min(size.width / (east - west), size.height / (north - south)) * 0.88f * zoom
        val left = (size.width - (east - west) * scale) / 2f
        val top = (size.height - (north - south) * scale) / 2f
        val position = Offset(
            left + (series!!.longitude.toFloat() - west) * scale,
            top + (north - series.latitude.toFloat()) * scale,
        )
        if (position.x !in 10f..(size.width - 10f) || position.y !in 10f..(size.height - 10f)) return@Canvas
        val color = when (metric) {
            InmetMetric.HOURLY_RAINFALL -> Color(0xFF58B9FF)
            InmetMetric.TEMPERATURE -> Color(0xFFFFC857)
            InmetMetric.WIND -> Color(0xFF57E389)
        }
        drawCircle(Color(0xCC091D31), 13.dp.toPx(), position)
        drawCircle(color, 8.dp.toPx(), position)
        drawCircle(Color.White, 8.dp.toPx(), position, style = Stroke(width = 1.dp.toPx()))

        val suffix = when (metric) {
            InmetMetric.TEMPERATURE -> "°C"
            InmetMetric.HOURLY_RAINFALL -> "mm (1h)"
            InmetMetric.WIND -> "km/h"
        }
        val value = String.format(java.util.Locale("pt", "BR"), "%.1f %s", current.second, suffix)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = android.graphics.Color.WHITE
            this.textSize = 10.dp.toPx()
            this.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            setShadowLayer(4.dp.toPx(), 1f, 1f, android.graphics.Color.BLACK)
        }
        val width = paint.measureText(value)
        val preferred = position.x + 15.dp.toPx()
        val x = if (preferred + width < size.width - 4.dp.toPx()) preferred
                else (position.x - width - 15.dp.toPx()).coerceAtLeast(3.dp.toPx())
        drawContext.canvas.nativeCanvas.drawText(value, x, position.y - 6.dp.toPx(), paint)
    }
}
