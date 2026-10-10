package br.com.blaise.rj

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.unit.dp
import kotlin.math.min

/**
 * Real (simplified) geographic foundation for Rio de Janeiro.
 * No heat map or synthetic radar pixels are painted over it.
 * Map projections are schematic/equirectangular at state scale, not a navigation product.
 */
@Composable
internal fun RioGeographicBase(modifier: Modifier = Modifier, zoom: Float = 1f) {
    val outlines = remember { RioMunicipalityGeometry.rings }
    Canvas(modifier = modifier) {
        val sea = Color(0xFF062D57)
        drawRect(
            brush = Brush.verticalGradient(
                listOf(Color(0xFF051C38), sea, Color(0xFF093769)),
            ),
        )
        val west = RioMunicipalityGeometry.WEST
        val east = RioMunicipalityGeometry.EAST
        val south = RioMunicipalityGeometry.SOUTH
        val north = RioMunicipalityGeometry.NORTH
        val scale = min(size.width / (east - west), size.height / (north - south)) * 0.88f * zoom
        val left = (size.width - (east - west) * scale) / 2f
        val top = (size.height - (north - south) * scale) / 2f
        fun locate(longitude: Float, latitude: Float): Offset =
            Offset(left + (longitude - west) * scale, top + (north - latitude) * scale)

        // Subtle geographic grid, not a precipitation overlay.
        for (i in 1..5) {
            val x = size.width * i / 6f
            val y = size.height * i / 6f
            drawLine(Color(0xFF39719A).copy(alpha = 0.20f), Offset(x, 0f), Offset(x, size.height), strokeWidth = 1.dp.toPx())
            drawLine(Color(0xFF39719A).copy(alpha = 0.20f), Offset(0f, y), Offset(size.width, y), strokeWidth = 1.dp.toPx())
        }
        for (ring in outlines) {
            val polygon = Path()
            ring.forEachIndexed { index, point ->
                val xy = locate(point.longitude, point.latitude)
                if (index == 0) polygon.moveTo(xy.x, xy.y) else polygon.lineTo(xy.x, xy.y)
            }
            polygon.close()
            drawPath(polygon, Color(0xFF143E45))
            drawPath(polygon, Color(0xFF5FA8A1).copy(alpha = 0.60f), style = Stroke(width = 0.65.dp.toPx()))
        }

        // Geographic reference positions only; not live monitoring station coordinates.
        val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.WHITE
            textSize = 10.dp.toPx()
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            setShadowLayer(3.dp.toPx(), 1f, 1f, android.graphics.Color.BLACK)
        }
        val compact = size.width < 570.dp.toPx()
        val cities = if (compact) listOf(
            Triple("Rio", -43.196f, -22.907f),
            Triple("Petrópolis", -43.178f, -22.506f),
            Triple("Campos", -41.322f, -21.762f),
            Triple("Volta Redonda", -44.104f, -22.522f),
        ) else listOf(
            Triple("Rio de Janeiro", -43.196f, -22.907f),
            Triple("Niterói", -43.115f, -22.883f),
            Triple("Petrópolis", -43.178f, -22.506f),
            Triple("Nova Friburgo", -42.532f, -22.282f),
            Triple("Campos", -41.322f, -21.762f),
            Triple("Cabo Frio", -42.018f, -22.889f),
            Triple("Volta Redonda", -44.104f, -22.522f),
        )
        for ((label, lon, lat) in cities) {
            val position = locate(lon, lat)
            if (position.x in 15f..(size.width - 15f) && position.y in 12f..(size.height - 12f)) {
                drawCircle(Color(0xFFFFD256), radius = 3.5.dp.toPx(), center = position)
                val right = position.x + 7.dp.toPx()
                val width = labelPaint.measureText(label)
                val textX = if (right + width < size.width - 5.dp.toPx()) right else position.x - width - 6.dp.toPx()
                drawContext.canvas.nativeCanvas.drawText(label, textX, position.y - 5.dp.toPx(), labelPaint)
            }
        }
        val copyrightPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(188, 215, 221)
            textSize = 9.dp.toPx()
        }
        drawContext.canvas.nativeCanvas.drawText(
            "Limites municipais: geodata-br / IBGE • CC0", 9.dp.toPx(), size.height - 10.dp.toPx(), copyrightPaint,
        )
    }
}
