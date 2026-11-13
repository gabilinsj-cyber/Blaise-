package br.com.blaise.rj.map

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.data.StatewideSnapshot
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.cos
import kotlin.math.min
import org.json.JSONObject

internal data class GeoPoint(val longitude: Double, val latitude: Double)
internal data class GeoCity(val ibge: Int, val rings: List<List<GeoPoint>>)
internal data class GeoData(val cities: List<GeoCity>, val west: Double, val east: Double, val south: Double, val north: Double)

/** CC0 IBGE-derived geometries for UI visualization, never authoritative risk geofences. */
internal object RjLocalGeometry {
    const val ASSET = "rj_municipios_geodata_cc0.geojson"
    fun parse(text: String): GeoData {
        val root = JSONObject(text)
        require(root.getString("type") == "FeatureCollection")
        val features = root.getJSONArray("features")
        require(features.length() == 92)
        val allowed = RioMunicipalities.all.map { it.ibgeCode }.toSet()
        val seen = mutableSetOf<Int>()
        val cities = ArrayList<GeoCity>(92)
        var west = Double.POSITIVE_INFINITY
        var east = Double.NEGATIVE_INFINITY
        var south = Double.POSITIVE_INFINITY
        var north = Double.NEGATIVE_INFINITY
        for (i in 0 until features.length()) {
            val feature = features.getJSONObject(i)
            val id = feature.getJSONObject("properties").getString("id").toInt()
            require(id in allowed && seen.add(id))
            val shape = feature.getJSONObject("geometry")
            require(shape.getString("type") == "Polygon")
            val coordinates = shape.getJSONArray("coordinates")
            require(coordinates.length() > 0)
            val rings = ArrayList<List<GeoPoint>>()
            for (j in 0 until coordinates.length()) {
                val points = coordinates.getJSONArray(j)
                require(points.length() >= 4)
                val ring = ArrayList<GeoPoint>(points.length())
                for (k in 0 until points.length()) {
                    val xy = points.getJSONArray(k)
                    val lon = xy.getDouble(0)
                    val lat = xy.getDouble(1)
                    require(lon.isFinite() && lat.isFinite() && lon in -46.0..-40.0 && lat in -25.0..-20.0)
                    west = minOf(west, lon)
                    east = maxOf(east, lon)
                    south = minOf(south, lat)
                    north = maxOf(north, lat)
                    ring.add(GeoPoint(lon, lat))
                }
                rings.add(ring)
            }
            cities.add(GeoCity(id, rings))
        }
        require(seen == allowed && west < east && south < north)
        return GeoData(cities, west, east, south, north)
    }
}

private fun hydrologyFill(level: Int?): Color = when (level) {
    1 -> Color(0xFF235C50)
    2 -> Color(0xFF6A6230)
    3 -> Color(0xFF82542C)
    4 -> Color(0xFF833B40)
    5 -> Color(0xFFA83A45)
    else -> Color(0xFF153B56)
}

/**
 * Standalone native RJ map: local polygons, no external map tiles or invented
 * station coordinates. Renders a risk layer ONLY for a fresh worker-active
 * snapshot and current municipal risk products; radar frames remain unavailable
 * until a real georeferenced radar adapter is integrated.
 */
@Composable
fun RjMeteorologicalOwnMap(
    selectedIbges: Set<Int>,
    statewideSnapshot: StatewideSnapshot?,
    observedNow: Instant,
    modifier: Modifier = Modifier,
    mapHeight: Dp = 320.dp,
) {
    val context = LocalContext.current
    val geometry = remember(context) {
        runCatching {
            context.assets.open(RjLocalGeometry.ASSET).bufferedReader().use { RjLocalGeometry.parse(it.readText()) }
        }.getOrNull()
    }
    val snapshot = statewideSnapshot?.takeIf { it.workerActive && it.current(observedNow) }
    val risks = snapshot?.municipalities.orEmpty().mapNotNull { row ->
        row.risk.takeIf { it.current(observedNow) }?.level?.let { row.ibge to it }
    }.toMap()
    var showRisk by remember { mutableStateOf(true) }
    var zoom by remember { mutableFloatStateOf(1f) }
    var pan by remember { mutableStateOf(Offset.Zero) }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { showRisk = true }, enabled = !showRisk) { Text("Risco hidrológico") }
            OutlinedButton(onClick = { showRisk = false }, enabled = showRisk) { Text("Território") }
        }
        if (geometry == null) {
            Text("Geometria municipal indisponível; mapa não foi estimado.", color = Color.LightGray)
        } else {
            Canvas(
                Modifier.fillMaxWidth().height(mapHeight)
                    .background(Color(0xFF061B31), RoundedCornerShape(14.dp))
                    .pointerInput(Unit) {
                        detectTransformGestures { _, drag, zoomChange, _ ->
                            zoom = (zoom * zoomChange).coerceIn(1f, 6f)
                            pan += drag
                        }
                    }
            ) {
                val midLat = (geometry.north + geometry.south) / 2.0
                val longitudeFactor = cos(Math.toRadians(midLat))
                val worldWidth = (geometry.east - geometry.west) * longitudeFactor
                val worldHeight = geometry.north - geometry.south
                val factor = min(size.width * 0.9f / worldWidth.toFloat(),
                    size.height * 0.9f / worldHeight.toFloat())
                val left = (size.width - (worldWidth * factor).toFloat()) / 2f
                val top = (size.height - (worldHeight * factor).toFloat()) / 2f
                fun project(point: GeoPoint): Offset = Offset(
                    left + ((point.longitude - geometry.west) * longitudeFactor * factor).toFloat(),
                    top + ((geometry.north - point.latitude) * factor).toFloat()
                )
                withTransform({
                    translate(pan.x, pan.y)
                    scale(zoom, zoom, pivot = Offset(size.width / 2f, size.height / 2f))
                }) {
                    for (city in geometry.cities) {
                        val path = Path().apply { fillType = PathFillType.EvenOdd }
                        for (ring in city.rings) {
                            val first = project(ring.first())
                            path.moveTo(first.x, first.y)
                            for (point in ring.drop(1)) {
                                val xy = project(point)
                                path.lineTo(xy.x, xy.y)
                            }
                            path.close()
                        }
                        val risk = if (showRisk) risks[city.ibge] else null
                        drawPath(path, hydrologyFill(risk), style = Fill)
                        drawPath(path,
                            if (city.ibge in selectedIbges) Color(0xFFF2CC67) else Color(0xFF5A94B5),
                            style = Stroke(width = if (city.ibge in selectedIbges) 2.2f else 0.75f)
                        )
                    }
                }
            }
        }
        if (showRisk && risks.isNotEmpty()) {
            val timestamp = snapshot?.generatedAt?.atZone(ZoneId.of("America/Sao_Paulo"))
                ?.format(DateTimeFormatter.ofPattern("dd/MM HH:mm:ss")).orEmpty()
            Text("Risco hidrológico por município • " + timestamp + " (Brasília) • " + risks.size +
                " áreas com medição recente", color = Color.White, fontWeight = FontWeight.SemiBold)
            Text("Cores indicam níveis do produto hidrológico, não alertas oficiais, radar ou tsunami.",
                color = Color.LightGray)
        } else {
            Text("Dados de risco georreferenciados indisponíveis ou camada territorial selecionada.",
                color = Color.LightGray)
        }
        Text("Mapa próprio • 92 municípios • geometria IBGE derivada (CC0; visualização). Ampliar com dois dedos. Radar Sumaré requer quadros reais com referência espacial, fonte e horário.",
            color = Color.LightGray)
    }
}
