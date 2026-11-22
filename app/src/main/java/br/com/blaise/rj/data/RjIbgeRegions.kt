package br.com.blaise.rj.data

import br.com.blaise.rj.cities.RioMunicipalities
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

/** IBGE immediate regions, not inferred municipalities or hand-drawn boundaries. */
data class RjIbgeRegionIndex(val municipalityRegions: Map<Int, String>) {
    val names: List<String> = municipalityRegions.values.distinct().sorted()
    fun municipalitiesIn(name: String): Set<Int> =
        municipalityRegions.filterValues { it == name }.keys
}
object RjIbgeRegions {
    const val URL_IBGE = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/33/municipios"
    const val MAX_BYTES = 512 * 1024

    fun parse(raw: String): RjIbgeRegionIndex {
        require(raw.length in 10..MAX_BYTES)
        val arr = JSONArray(raw)
        val allowed = RioMunicipalities.all.map { it.ibgeCode }.toSet()
        require(allowed.size == 92)
        val regions = mutableMapOf<Int,String>()
        for (i in 0 until arr.length()) {
            val row = arr.optJSONObject(i) ?: continue
            val code = row.optInt("id", 0)
            if (code !in allowed || regions.containsKey(code)) continue
            val imediata = row.optJSONObject("regiao-imediata") ?: continue
            val nome = imediata.optString("nome").trim()
            if (nome.isEmpty() || nome.length > 90) continue
            regions[code] = nome
        }
        require(regions.keys == allowed) { "ibge_92_regions_incomplete" }
        return RjIbgeRegionIndex(regions.toMap())
    }

    suspend fun fetch(): RjIbgeRegionIndex = withContext(Dispatchers.IO) {
        val conn = (URL(URL_IBGE).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            instanceFollowRedirects = false
            connectTimeout = 7000
            readTimeout = 7000
            setRequestProperty("Accept", "application/json")
        }
        try {
            require(conn.responseCode == 200) { "ibge_regions_http" }
            val out = ByteArrayOutputStream()
            conn.inputStream.use { input ->
                val buf = ByteArray(4096)
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    out.write(buf, 0, n)
                    require(out.size() <= MAX_BYTES) { "ibge_regions_too_large" }
                }
            }
            parse(out.toString(Charsets.UTF_8.name()))
        } finally { conn.disconnect() }
    }
}
