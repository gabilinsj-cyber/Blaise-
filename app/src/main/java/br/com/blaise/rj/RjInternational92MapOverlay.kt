package br.com.blaise.rj

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import br.com.blaise.rj.data.RjInternational92Snapshot
import java.time.Instant
import kotlin.math.min

/**
 * Source-bound plotted points only, over the Blaise own 92 municipality map.
 * Never paints an interpolated heat/rain/radar layer, nor claims these
 * provider model estimates are Brazilian measured station observations.
 */
@Composable
internal fun RjInternational92MapOverlay(
    snapshot: RjInternational92Snapshot?,
    now: Instant,
    metric: String,
    zoom: Float,
    modifier: Modifier = Modifier,
) {
    val rows = snapshot?.takeIf { it.current(now) }?.values?.values
        ?.filter { it.current(now) }.orEmpty()
    if (rows.isEmpty() || metric !in setOf("Temperatura","Sensação térmica","Vento","Chuva"))
        return
    Canvas(modifier.fillMaxSize()) {
        val west = RioMunicipalityGeometry.WEST
        val east = RioMunicipalityGeometry.EAST
        val south = RioMunicipalityGeometry.SOUTH
        val north = RioMunicipalityGeometry.NORTH
        val scale = min(size.width / (east-west),size.height / (north-south)) * 0.88f * zoom
        val left = (size.width-(east-west)*scale)/2f
        val top = (size.height-(north-south)*scale)/2f
        rows.forEach { row ->
            val value = when (metric) {
                "Temperatura" -> row.temperatureC
                "Sensação térmica" -> row.feelsLikeC
                "Vento" -> row.windKmh
                else -> row.rainMm1h
            }
            if (value == null) return@forEach
            val x = left + (row.longitude.toFloat()-west)*scale
            val y = top + (north-row.latitude.toFloat())*scale
            if (x !in 0f..size.width || y !in 0f..size.height) return@forEach
            val tone = when(metric) {
                "Temperatura", "Sensação térmica" -> if(value >= 35) Color(0xFFFF5E45) else if(value >= 29) Color(0xFFFFC84A) else Color(0xFF58C6FF)
                "Vento" -> if(value>=65) Color(0xFFFF7043) else if(value>=35) Color(0xFFFFC843) else Color(0xFF5EDEBA)
                else -> if(value >= 20) Color(0xFFFF593D) else if(value>=5) Color(0xFFFFCB3F) else Color(0xFF47BAFF)
            }
            val center = Offset(x,y)
            drawCircle(Color.Black, radius=5.5f,center=center)
            drawCircle(tone,radius=4.2f,center=center)
            drawCircle(Color.White,radius=4.8f,center=center,style=Stroke(width=0.8f))
        }
    }
}
