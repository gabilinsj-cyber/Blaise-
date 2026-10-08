package br.com.blaise.rj.data

import br.com.blaise.rj.billing.LocalPurchaseState
import br.com.blaise.rj.billing.PlayPurchaseCandidate
import br.com.blaise.rj.cities.RioMunicipalities
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.time.Duration
import java.time.Instant
import java.util.concurrent.Executors

const val STATEWIDE_DATA_PATH = "/v1/data/municipalities"

data class StatewideRisk(val state: String, val label: String?, val level: Int?, val observedAt: Instant?, val sourceUrl: String, val region: String?) {
    fun current(now: Instant): Boolean = state in setOf("CURRENT", "CURRENT_DEGRADED") &&
        level != null && level in 1..5 && label != null && observedAt != null &&
        !observedAt.isAfter(now) && Duration.between(observedAt, now).seconds <= 1800
}
data class StatewideWarning(val id: String, val event: String, val severity: String, val sent: Instant, val onset: Instant,
    val expires: Instant, val municipalityIbges: List<Int>, val attribution: String) {
    fun current(now: Instant) = !sent.isAfter(now) && !onset.isAfter(now) && expires.isAfter(now)
}
data class StatewideMunicipality(val ibge: Int, val name: String, val seaFacing: Boolean, val risk: StatewideRisk,
    val warningIds: List<String>, val warningCoverage: String)
data class StatewideSource(val id: String, val name: String, val products: List<String>, val scope: String,
    val state: String, val connectedProduct: String?)
data class StatewideSnapshot(val generatedAt: Instant, val workerActive: Boolean,
    val municipalities: List<StatewideMunicipality>, val warnings: List<StatewideWarning>, val sources: List<StatewideSource>) {
    init {
        require(municipalities.size == 92 && municipalities.map { it.ibge }.toSet().size == 92)
        require(municipalities.all { RioMunicipalities.byIbgeCode(it.ibge)?.name == it.name })
        require(warnings.size <= 64 && warnings.map { it.id }.toSet().size == warnings.size)
        require(warnings.all { w -> w.municipalityIbges.all { RioMunicipalities.byIbgeCode(it) != null } && w.expires > w.onset })
        require(municipalities.all { city -> city.warningIds.all { id -> warnings.any { it.id == id && city.ibge in it.municipalityIbges } } })
        require(sources.size in 1..32 && sources.map { it.id }.toSet().size == sources.size)
        require(sources.none { it.id.contains("inea", ignoreCase = true) })
    }
    fun current(now: Instant) = !generatedAt.isAfter(now) && Duration.between(generatedAt, now).seconds <= 120
}
sealed interface StatewideDataResult {
    data class Available(val snapshot: StatewideSnapshot) : StatewideDataResult
    data object Denied : StatewideDataResult
    data object Unavailable : StatewideDataResult
}

object StatewideDataParser {
    private fun <T> map(array: JSONArray, transform: (JSONObject) -> T) = (0 until array.length()).map { transform(array.getJSONObject(it)) }
    private fun strings(array: JSONArray) = (0 until array.length()).map { array.getString(it).also { s -> require(s.length <= 256 && s.none { c -> c.code < 32 }) } }
    private fun optional(obj: JSONObject, key: String) = if (obj.isNull(key)) null else obj.getString(key)
    fun parse(root: JSONObject): StatewideSnapshot {
        require(root.getString("contract") == "RJ_92_MUNICIPALITIES_V1" && root.getString("scope") == "RJ_92_MUNICIPALITIES")
        val municipalities = map(root.getJSONArray("municipalities")) { row ->
            val risk = row.getJSONObject("hydrologicalRisk")
            val state = risk.getString("state")
            require(state in setOf("CURRENT", "CURRENT_DEGRADED", "STALE", "UNAVAILABLE"))
            val sourceUrl = risk.getString("sourceUrl")
            require(sourceUrl == "https://painelcemadenrj.defesacivil.rj.gov.br/monitoramento/v2/municipio/?action=hidro")
            val coverage = row.getString("warningCoverage")
            require(coverage in setOf("UNAVAILABLE", "INVENTORY_LIMIT", "PARTIAL_UNRESOLVED_AREAS", "EXACT_IBGE_ONLY"))
            StatewideMunicipality(row.getString("ibge").toInt(), row.getString("name"), row.getBoolean("seaFacing"),
                StatewideRisk(state, optional(risk, "label"), if (risk.isNull("level")) null else risk.getInt("level"),
                    optional(risk, "observedAt")?.let(Instant::parse), sourceUrl, optional(risk, "region")),
                strings(row.getJSONArray("warningIds")), coverage)
        }
        val warnings = map(root.getJSONArray("warnings")) { row ->
            require(row.getString("sourceUrl") == "https://apiprevmet3.inmet.gov.br/avisos/rss")
            StatewideWarning(row.getString("id"), row.getString("event"), row.getString("severity"),
                Instant.parse(row.getString("sent")), Instant.parse(row.getString("onset")), Instant.parse(row.getString("expires")),
                strings(row.getJSONArray("municipalityIbges")).map(String::toInt), row.getString("attribution"))
        }
        val sources = map(root.getJSONArray("sources")) { row -> StatewideSource(row.getString("id"), row.getString("name"),
            strings(row.getJSONArray("products")), row.getString("scope"), row.getString("state"), optional(row, "connectedProduct")) }
        return StatewideSnapshot(Instant.parse(root.getString("generatedAt")), root.getBoolean("workerActive"), municipalities, warnings, sources)
    }
}

class StatewideDataHttpsClient private constructor(private val endpoint: URI, private val packageName: String) {
    fun fetch(candidate: PlayPurchaseCandidate, callback: (StatewideDataResult) -> Unit) {
        if (candidate.state != LocalPurchaseState.PURCHASED || candidate.purchaseToken.isBlank() || candidate.productIds.isEmpty()) {
            callback(StatewideDataResult.Unavailable); return
        }
        executor.execute { callback(runCatching { fetchBlocking(candidate) }.getOrDefault(StatewideDataResult.Unavailable)) }
    }
    private fun fetchBlocking(candidate: PlayPurchaseCandidate): StatewideDataResult {
        val connection = endpoint.toURL().openConnection() as HttpURLConnection
        try {
            connection.instanceFollowRedirects = false
            connection.requestMethod = "POST"; connection.doOutput = true
            connection.connectTimeout = 7000; connection.readTimeout = 7000
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cache-Control", "no-store")
            val body = JSONObject().put("packageName", packageName).put("purchaseToken", candidate.purchaseToken)
                .put("productIds", JSONArray(candidate.productIds)).toString().toByteArray(Charsets.UTF_8)
            connection.setFixedLengthStreamingMode(body.size)
            connection.outputStream.use { it.write(body) }
            if (connection.responseCode == 403) return StatewideDataResult.Denied
            if (connection.responseCode != 200) return StatewideDataResult.Unavailable
            val output = java.io.ByteArrayOutputStream()
            connection.inputStream.use { input ->
                val buffer = ByteArray(8192)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= 1024 * 1024)
                    output.write(buffer, 0, count)
                }
            }
            val bytes = output.toByteArray()
            return StatewideDataResult.Available(StatewideDataParser.parse(JSONObject(bytes.toString(Charsets.UTF_8))))
        } finally { connection.disconnect() }
    }
    companion object {
        private val executor = Executors.newFixedThreadPool(2) { runnable -> Thread(runnable, "blaise-statewide-data").apply { isDaemon = true } }
        fun create(verifier: String, packageName: String): StatewideDataHttpsClient? {
            val base = DashboardDataEndpointPolicy.deriveFromEntitlementVerifier(verifier)?.let(::URI) ?: return null
            if (packageName.isBlank()) return null
            return StatewideDataHttpsClient(URI("https", null, base.host, base.port, STATEWIDE_DATA_PATH, null, null), packageName)
        }
    }
}
