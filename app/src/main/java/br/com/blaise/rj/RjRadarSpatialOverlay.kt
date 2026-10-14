package br.com.blaise.rj

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import java.time.Duration
import java.time.Instant
import kotlin.math.min

/**
 * Rendering only. This class never fetches a provider radar image, generates
 * synthetic rain, interpolates station records or authorizes source licensing.
 * A future authenticated backend adapter must supply actual calibrated cells.
 */
data class RjRadarMeasuredCell(
    val latitude: Double,
    val longitude: Double,
    val rainRateMmH: Double,
    val footprintKm: Double,
)

data class RjRadarMeasuredFrame(
    val providerId: String,
    val radarId: String,
    val calibrationId: String,
    val sourceUrl: String,
    val observedAt: Instant,
    val dataType: String,
    val commercialUseVerifiedByBackend: Boolean,
    val cells: List<RjRadarMeasuredCell>,
)

object RjRadarSpatialPolicy {
    fun current(frame: RjRadarMeasuredFrame?, now: Instant): Boolean {
        if (frame == null || frame.dataType != "GEOREFERENCED_MEASURED_RADAR_RAIN_RATE"
            || !frame.commercialUseVerifiedByBackend) return false
        if (!Regex("[A-Za-z0-9][A-Za-z0-9._-]{1,83}").matches(frame.providerId)
            || !Regex("[A-Za-z0-9][A-Za-z0-9._-]{1,83}").matches(frame.radarId)
            || !Regex("[A-Za-z0-9][A-Za-z0-9._-]{1,83}").matches(frame.calibrationId)
            || !frame.sourceUrl.startsWith("https://")) return false
        val age = Duration.between(frame.observedAt, now).seconds
        if (age !in 0..300 || frame.cells.size !in 1..4096) return false
        return frame.cells.all { c ->
            c.latitude.isFinite() && c.latitude in -24.3..-20.4 &&
                c.longitude.isFinite() && c.longitude in -45.2..-40.4 &&
                c.rainRateMmH.isFinite() && c.rainRateMmH in 0.0..500.0 &&
                c.footprintKm.isFinite() && c.footprintKm in 0.1..10.0
        } && frame.cells.map { "${it.latitude}:${it.longitude}" }.distinct().size == frame.cells.size
    }
}

@Composable
internal fun RjRadarSpatialOverlay(
    frame: RjRadarMeasuredFrame?,
    now: Instant,
    zoom: Float,
    modifier: Modifier = Modifier,
) {
    if (!RjRadarSpatialPolicy.current(frame, now)) return
    val safeFrame = requireNotNull(frame)
    Canvas(modifier = modifier) {
        // Identical state-scale projection to RioGeographicBase.
        val west = RioMunicipalityGeometry.WEST
        val east = RioMunicipalityGeometry.EAST
        val south = RioMunicipalityGeometry.SOUTH
        val north = RioMunicipalityGeometry.NORTH
        val scale = min(size.width / (east - west), size.height / (north - south)) * 0.88f * zoom
        val left = (size.width - (east - west) * scale) / 2f
        val top = (size.height - (north - south) * scale) / 2f

        safeFrame.cells.forEach { point ->
            if (point.rainRateMmH <= 0.0) return@forEach
            val x = left + (point.longitude.toFloat() - west) * scale
            val y = top + (north - point.latitude.toFloat()) * scale
            if (x !in 0f..size.width || y !in 0f..size.height) return@forEach
            // Convert measured radar cell footprint to a small approximate
            // state-scale symbol, not an interpolated storm polygon.
            val square = (point.footprintKm / 111.0 * scale).toFloat().coerceAtLeast(2f)
            val color = when {
                point.rainRateMmH < 2.0 -> Color(0xFF00B7ED)
                point.rainRateMmH < 10.0 -> Color(0xFF20D75A)
                point.rainRateMmH < 25.0 -> Color(0xFFFFD528)
                point.rainRateMmH < 60.0 -> Color(0xFFFF5D1A)
                else -> Color(0xFFDF36B5)
            }
            drawRect(color.copy(alpha = 0.80f),
                topLeft = Offset(x - square / 2f, y - square / 2f),
                size = Size(square, square))
        }
    }
}
