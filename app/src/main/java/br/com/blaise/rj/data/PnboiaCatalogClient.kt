package br.com.blaise.rj.data

import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray

/** Station inventory only. A recent inventory timestamp is not a sensor reading. */
data class PnboiaStation(
    val id: Int, val name: String, val local: String, val mode: String,
    val project: String, val latitude: Double, val longitude: Double,
    val lastRecordAt: Instant?,
) {
    fun eligibleForRjCatalog(): Boolean = id in 1..100 &&
        project in setOf("PNBOIA", "REMOBS") && mode != "TESTES" &&
        name.isNotBlank() && name.length <= 160 && local.length <= 160 &&
        Regex("(^|[,\\s])RJ($|[,\\s])", RegexOption.IGNORE_CASE).containsMatchIn(local) &&
        latitude.isFinite() && longitude.isFinite() &&
        latitude in -26.0..-20.0 && longitude in -45.5..-38.0

    fun statusLabel(): String = when (mode) {
        "FUNDEADA" -> "Fundeada; sensores ainda não validados"
        "MANUTENCAO" -> "Em manutenção"
        "INOPERANTE" -> "Inoperante"
        "DERIVA", "DERIVANDO" -> "Em deriva"
        "GAP" -> "Falha na transmissão"
        else -> "Situação não confirmada"
    }
}

sealed interface PnboiaCatalogResult {
    data class Available(val stations: List<PnboiaStation>, val fetchedAt: Instant) : PnboiaCatalogResult
    data object Unavailable : PnboiaCatalogResult
}

class PnboiaCatalogClient {
    companion object {
        const val SOURCE_URL = "https://api-boias.remobs.com.br/public/moored/stations"
        const val OFFICIAL_MAP = "https://pnboia-brasil.github.io/pnboia-mapa/"
    }
    suspend fun fetch(): PnboiaCatalogResult = withContext(Dispatchers.IO) {
        try {
            val connection = URL(SOURCE_URL).openConnection() as HttpURLConnection
            val text = try {
                connection.connectTimeout = 8000
                connection.readTimeout = 8000
                connection.instanceFollowRedirects = false
                connection.setRequestProperty("Accept", "application/json")
                check(connection.responseCode == 200)
                check(connection.contentType.orEmpty().contains("application/json", ignoreCase = true))
                connection.inputStream.use { input ->
                    val output = java.io.ByteArrayOutputStream()
                    val buffer = ByteArray(8192)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        check(output.size() + count <= 512 * 1024)
                        output.write(buffer, 0, count)
                    }
                    output.toString("UTF-8")
                }
            } finally { connection.disconnect() }
            val rows = JSONArray(text)
            check(rows.length() in 1..500)
            val now = Instant.now()
            val stations = (0 until rows.length()).mapNotNull { index ->
                val row = rows.optJSONObject(index) ?: return@mapNotNull null
                val id = row.optDouble("id", Double.NaN)
                if (!id.isFinite() || id % 1.0 != 0.0 || id !in 1.0..100.0) return@mapNotNull null
                val last = runCatching { Instant.parse(row.optString("last_date_time")) }.getOrNull()
                    ?.takeIf { !it.isAfter(now) }
                PnboiaStation(id.toInt(), row.optString("name"), row.optString("local"),
                    row.optString("mode"), row.optString("project"),
                    row.optDouble("latitude", Double.NaN), row.optDouble("longitude", Double.NaN), last)
                    .takeIf { it.eligibleForRjCatalog() }
            }.distinctBy { it.id }.sortedWith(compareBy<PnboiaStation> { it.mode != "FUNDEADA" }.thenBy { it.name })
            PnboiaCatalogResult.Available(stations, now)
        } catch (error: CancellationException) { throw error }
        catch (_: Exception) { PnboiaCatalogResult.Unavailable }
    }
}
