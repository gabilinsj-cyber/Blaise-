package br.com.blaise.rj.geo

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import br.com.blaise.rj.data.StatewideSnapshot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.io.ByteArrayOutputStream
import kotlin.math.min

/** Render IBGE public geography with our own Canvas. Never synthesize rain/radar pixels. */
private const val IBGE_RJ_GEOJSON =
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/33?intrarregiao=municipio&formato=application%2Fvnd.geo%2Bjson&qualidade=minima"

private data class Vertex(val lon: Float, val lat: Float)
private data class MunicipalityShape(val ibge: Int?, val rings: List<List<Vertex>>)
private data class BoundaryMap(
    val shapes: List<MunicipalityShape>,
    val west: Float,
    val east: Float,
    val south: Float,
    val north: Float,
)

/** Network and parsing are isolated; no telemetry, location, client ID, or user history is sent. */
private fun loadRjMap(): BoundaryMap? {
    val conn = URL(IBGE_RJ_GEOJSON).openConnection() as HttpURLConnection
    return try {
        conn.instanceFollowRedirects = false
        conn.connectTimeout = 7_000
        conn.readTimeout = 9_000
        conn.setRequestProperty("Accept", "application/geo+json, application/json")
        if (conn.responseCode != 200) return null
        val out = ByteArrayOutputStream()
        conn.inputStream.use { stream ->
            val buf = ByteArray(8192)
            while (true) {
                val read = stream.read(buf)
                if (read < 0) break
                if (out.size() + read > 6 * 1024 * 1024) return null
                out.write(buf, 0, read)
            }
        }
        val root = JSONObject(out.toString(Charsets.UTF_8.name()))
        val features = root.optJSONArray("features") ?: return null
        if (features.length() !in 1..500) return null
        val shapes = mutableListOf<MunicipalityShape>()
        var west = Float.POSITIVE_INFINITY
        var east = Float.NEGATIVE_INFINITY
        var south = Float.POSITIVE_INFINITY
        var north = Float.NEGATIVE_INFINITY
        fun ring(raw: JSONArray): List<Vertex> = buildList {
            for (i in 0 until raw.length()) {
                val point = raw.optJSONArray(i) ?: continue
                if (point.length() < 2) continue
                val lon = point.optDouble(0, Double.NaN).toFloat()
                val lat = point.optDouble(1, Double.NaN).toFloat()
                if (!lon.isFinite() || !lat.isFinite() || lon !in -46f..-39f || lat !in -26f..-19f) continue
                west = minOf(west, lon); east = maxOf(east, lon)
                south = minOf(south, lat); north = maxOf(north, lat)
                add(Vertex(lon, lat))
            }
        }
        for (i in 0 until features.length()) {
            val feature = features.optJSONObject(i) ?: continue
            val geometry = feature.optJSONObject("geometry") ?: continue
            val raw = geometry.optJSONArray("coordinates") ?: continue
            val polygons = mutableListOf<List<Vertex>>()
            when (geometry.optString("type")) {
                "Polygon" -> raw.optJSONArray(0)?.let { ring(it) }?.let { if (it.size >= 3) polygons.add(it) }
                "MultiPolygon" -> for (p in 0 until raw.length()) {
                    raw.optJSONArray(p)?.optJSONArray(0)?.let { ring(it) }?.let { if (it.size >= 3) polygons.add(it) }
                }
            }
            if (polygons.isEmpty()) continue
            val properties = feature.optJSONObject("properties")
            val code = feature.optString("id").takeIf { it.matches(Regex("33\\d{5}")) }?.toIntOrNull()
                ?: properties?.optString("codarea")?.toIntOrNull()
            shapes.add(MunicipalityShape(code, polygons))
        }
        if (shapes.isEmpty() || !west.isFinite() || east <= west || north <= south) null
        else BoundaryMap(shapes, west, east, south, north)
    } catch (_: Exception) {
        null
    } finally {
        conn.disconnect()
    }
}

/** Geographic outline is factual; the coloring is used only for verified fresh municipal warnings/risks. */
@Composable
fun RjMunicipalMap(
    snapshot: StatewideSnapshot?, modifier: Modifier = Modifier,
    selectedIbgeCode: Int? = null,
    selectedRegionIbgeCodes: Set<Int> = emptySet(),
) {
    var boundary by remember { mutableStateOf<BoundaryMap?>(null) }
    var unavailable by remember { mutableStateOf(false) }
    var zoom by remember { mutableFloatStateOf(1f) }
    LaunchedEffect(Unit) {
        boundary = withContext(Dispatchers.IO) { loadRjMap() }
        unavailable = boundary == null
    }
    val riskByCode = remember(snapshot) {
        snapshot?.municipalities?.associateBy { it.ibge }.orEmpty()
    }
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        val geometry = boundary
        if (geometry == null) {
            Text(if (unavailable) "Malha oficial IBGE indisponível. Nenhuma posição foi inventada."
                 else "Carregando limites geográficos oficiais do RJ…",
                color = Color(0xFFD7E5F7), textAlign = TextAlign.Center)
        } else {
            Canvas(
                modifier = Modifier.fillMaxSize().pointerInput(Unit) {
                    detectTransformGestures { _, _, ratio, _ ->
                        zoom = (zoom * ratio).coerceIn(1f, 5f)
                    }
                }
            ) {
                val padding = 14f
                val dx = geometry.east - geometry.west
                val dy = geometry.north - geometry.south
                val scale = min((size.width - 2 * padding) / dx, (size.height - 2 * padding) / dy) * zoom
                val middleX = (geometry.east + geometry.west) / 2f
                val middleY = (geometry.north + geometry.south) / 2f
                fun project(v: Vertex) = Offset(
                    size.width / 2 + (v.lon - middleX) * scale,
                    size.height / 2 - (v.lat - middleY) * scale
                )
                geometry.shapes.forEach { shape ->
                    val risk = shape.ibge?.let(riskByCode::get)?.risk
                    // Level 4/5 and unclassified warning overlays require a
                    // separately verified 20-second scientific decision.
                    // Existing municipal risk snapshots do not carry that proof.
                    val fill = when {
                        risk?.current(java.time.Instant.now()) == true -> when (risk.level) {
                            1 -> Color(0xFF236C4F)
                            2 -> Color(0xFF8B7C2E)
                            3 -> Color(0xFF9C612E)
                            else -> Color(0xFF16416B)
                        }
                        else -> if (shape.ibge in selectedRegionIbgeCodes)
                            Color(0xFF206A75) else Color(0xFF16416B)
                    }
                    shape.rings.forEach { ring ->
                        val path = Path().apply {
                            moveTo(project(ring.first()).x, project(ring.first()).y)
                            ring.drop(1).forEach { lineTo(project(it).x, project(it).y) }
                            close()
                        }
                        drawPath(path, fill, style = Fill)
                        // Selected municipality receives a gold boundary, not
                        // fabricated weather or a made-up radar intensity.
                        drawPath(path,
                            if (shape.ibge == selectedIbgeCode) Color(0xFFFFD166)
                            else Color(0xFF87B3D2),
                            style = Stroke(width = if (shape.ibge == selectedIbgeCode) 2.6f else 0.8f))
                    }
                }
            }
        }
    }
}
