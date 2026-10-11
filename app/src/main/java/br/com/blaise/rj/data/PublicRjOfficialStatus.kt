package br.com.blaise.rj.data

import br.com.blaise.rj.cities.RioMunicipalities
import java.net.HttpURLConnection
import java.net.URI
import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

const val PUBLIC_RJ_STATUS_PATH = "/v1/public/rj-status"
const val PUBLIC_RJ_STATUS_CONTRACT = "BLAISE_RJ_PUBLIC_OFFICIAL_STATUS_V1"

data class PublicRjRisk(
    val level: Int,
    val label: String,
    val observedAt: Instant,
    val sourceUrl: String,
    val sourceName: String,
) {
    fun current(now: Instant) =
        level in 1..5 && label.length in 1..80 &&
        sourceUrl == "https://painelcemadenrj.defesacivil.rj.gov.br/monitoramento/v2/municipio/?action=hidro" &&
        !observedAt.isAfter(now) &&
        Duration.between(observedAt, now).seconds in 0..1800
}

data class PublicRjWarning(
    val id: String, val event: String, val severity: String,
    val sent: Instant, val onset: Instant, val expires: Instant,
    val municipalityIbges: List<Int>,
    val sourceUrl: String,
) {
    fun current(now: Instant) = id.isNotBlank() && event.isNotBlank() &&
        !sent.isAfter(now) && !onset.isAfter(now) && expires.isAfter(now) &&
        sourceUrl == "https://apiprevmet3.inmet.gov.br/avisos/rss"
}
data class PublicRjMunicipality(
    val ibge: Int, val name: String, val risk: PublicRjRisk?,
    val warningIds: List<String>, val warningCoverage: String,
)

/** Provider-scoped runtime evidence, not a claim of 92 live thermometers. */
data class PublicRjSourceReading(
    val id: String, val label: String, val product: String?,
    val kind: String, val coverage: String, val status: String,
    val observedAt: Instant?,
) {
    init {
        require(id in setOf("alerta-rio", "defesa-civil", "inmet", "inpe-cptec", "windy"))
        require(label.length in 2..60 && kind.length in 4..80 && coverage.length in 4..90)
        require(product == null || product.length in 3..80)
        require(status in setOf("CURRENT_PRODUCT_ONLY", "STALE_OR_UNVERIFIED", "NOT_CONNECTED"))
        if (id in setOf("inpe-cptec", "windy")) {
            require(status == "NOT_CONNECTED" && product == null)
        }
    }
}

data class PublicRjFiveSourceHealth(
    val generatedAt: Instant, val sources: List<PublicRjSourceReading>,
    val workerRunning: Boolean,
) {
    init {
        require(sources.map { it.id } ==
            listOf("alerta-rio", "defesa-civil", "inmet", "inpe-cptec", "windy"))
    }
    fun current(now: Instant) = !generatedAt.isAfter(now) &&
        Duration.between(generatedAt, now).seconds in 0..120
}
data class PublicRjStatus(
    val generatedAt: Instant,
    val municipalities: List<PublicRjMunicipality>,
    val warnings: List<PublicRjWarning>,
    val fiveSourceHealth: PublicRjFiveSourceHealth? = null,
) {
    init {
        require(municipalities.size == 92)
        require(municipalities.map { it.ibge }.distinct().size == 92)
        require(municipalities.all { RioMunicipalities.byIbgeCode(it.ibge)?.name == it.name })
        require(warnings.size <= 64 && warnings.map { it.id }.distinct().size == warnings.size)
        require(warnings.all { it.municipalityIbges.all { ibge -> RioMunicipalities.byIbgeCode(ibge) != null } })
        require(municipalities.all { city -> city.warningIds.all { id ->
            warnings.any { warning -> warning.id == id && city.ibge in warning.municipalityIbges }
        } })
    }
    fun current(now: Instant) = !generatedAt.isAfter(now) &&
        Duration.between(generatedAt, now).seconds in 0..120
    fun municipality(ibge: Int, now: Instant): PublicRjMunicipality? =
        takeIf { it.current(now) }?.municipalities?.firstOrNull { it.ibge == ibge }
    fun warningsFor(ibge: Int, now: Instant): List<PublicRjWarning> =
        municipality(ibge, now)?.let { row -> warnings.filter {
            it.id in row.warningIds && ibge in it.municipalityIbges && it.current(now)
        } } ?: emptyList()
}
sealed interface PublicRjStatusResult {
    data class Available(val snapshot: PublicRjStatus) : PublicRjStatusResult
    data object Unavailable : PublicRjStatusResult
}

object PublicRjStatusParser {
    fun parse(root: JSONObject): PublicRjStatus {
        require(root.getString("contract") == PUBLIC_RJ_STATUS_CONTRACT)
        require(root.getString("scope") == "RJ_92_MUNICIPALITIES")
        require(root.getBoolean("workerActive") && root.getBoolean("usableOfficialProducts"))
        require(!root.getBoolean("thirdPartyImagesIncluded"))
        require(!root.getBoolean("subscriberDataIncluded"))
        val citiesJson=root.getJSONArray("municipalities")
        require(citiesJson.length() == 92)
        val municipalities=(0 until citiesJson.length()).map { idx ->
            val row=citiesJson.getJSONObject(idx)
            val risk=if(row.isNull("risk")) null else row.getJSONObject("risk").let { info ->
                val url=info.getString("sourceUrl")
                require(url == "https://painelcemadenrj.defesacivil.rj.gov.br/monitoramento/v2/municipio/?action=hidro")
                PublicRjRisk(info.getInt("level"),info.getString("label"),
                    Instant.parse(info.getString("observedAt")),url,
                    info.getString("sourceName"))
            }
            val ids=row.getJSONArray("warningIds")
            val warningIds=(0 until ids.length()).map(ids::getString)
            val coverage=row.getString("warningCoverage")
            require(coverage in setOf("UNAVAILABLE","INVENTORY_LIMIT","PARTIAL_UNRESOLVED_AREAS","EXACT_IBGE_ONLY"))
            PublicRjMunicipality(row.getString("ibge").toInt(),row.getString("name"),
                risk,warningIds,coverage)
        }
        val warningsJson=root.getJSONArray("warnings")
        require(warningsJson.length()<=64)
        val warnings=(0 until warningsJson.length()).map { idx ->
            val item=warningsJson.getJSONObject(idx)
            require(item.getString("attribution") == "EXACT_IBGE")
            val codes=item.getJSONArray("municipalityIbges")
            PublicRjWarning(item.getString("id"),item.getString("event"),item.getString("severity"),
                Instant.parse(item.getString("sent")),Instant.parse(item.getString("onset")),
                Instant.parse(item.getString("expires")),
                (0 until codes.length()).map { codes.getString(it).toInt() },
                item.getString("sourceUrl"))
        }
        val health = root.optJSONObject("fiveSourceHealth")?.let { envelope ->
            require(envelope.getString("contract") == "BLAISE_RJ_FIVE_SOURCE_HEALTH_V1")
            require(envelope.getString("scope") == "RJ_92_MUNICIPALITIES_BY_VERIFIED_COVERAGE")
            require(!envelope.getBoolean("fiveSimultaneousLiveFeedsConfirmed"))
            require(!envelope.getBoolean("weatherRadarSpatialFramesConfirmed"))
            require(envelope.getBoolean("noSubstitutedStateMeasurements"))
            val rows = envelope.getJSONArray("sources")
            require(rows.length() == 5)
            val values = (0 until rows.length()).map { index ->
                val item = rows.getJSONObject(index)
                require(!item.getBoolean("provenRealTimeFor92Cities"))
                require(!item.getBoolean("temperatureServiceConnected"))
                require(!item.getBoolean("radarFramesConnected"))
                PublicRjSourceReading(
                    item.getString("id"), item.getString("label"),
                    if (item.isNull("product")) null else item.getString("product"),
                    item.getString("kind"), item.getString("coverage"),
                    item.getString("status"),
                    if (item.isNull("observedAt")) null
                    else Instant.parse(item.getString("observedAt")),
                )
            }
            PublicRjFiveSourceHealth(
                Instant.parse(envelope.getString("generatedAt")),
                values, envelope.getBoolean("workerRunning"))
        }
        return PublicRjStatus(Instant.parse(root.getString("generatedAt")),municipalities,warnings,health)
    }
}

/** No purchase token, Firebase ID, or user location is sent. HTTPS only. */
class PublicRjStatusHttpsClient private constructor(private val endpoint: URI) {
    suspend fun fetch(): PublicRjStatusResult = withContext(Dispatchers.IO) {
        try { fetchBlocking() }
        catch (cancel: CancellationException) { throw cancel }
        catch (_: Exception) { PublicRjStatusResult.Unavailable }
    }
    private fun fetchBlocking(): PublicRjStatusResult {
        val connection=endpoint.toURL().openConnection() as HttpURLConnection
        try {
            connection.instanceFollowRedirects=false
            connection.requestMethod="GET"
            connection.connectTimeout=5_000
            connection.readTimeout=5_000
            connection.setRequestProperty("Accept","application/json")
            connection.setRequestProperty("Cache-Control","no-store")
            if(connection.responseCode != 200) return PublicRjStatusResult.Unavailable
            val out=java.io.ByteArrayOutputStream()
            connection.inputStream.use { input ->
                val buffer=ByteArray(8192)
                while (true) {
                    val n=input.read(buffer)
                    if(n<0)break
                    require(out.size()+n<=80*1024)
                    out.write(buffer,0,n)
                }
            }
            return PublicRjStatusResult.Available(
                PublicRjStatusParser.parse(JSONObject(out.toString(Charsets.UTF_8.name()))))
        }finally {connection.disconnect()}
    }
    companion object {
        fun create(baseUrl: String): PublicRjStatusHttpsClient? = runCatching {
            val uri=URI(baseUrl.trim())
            require(uri.scheme == "https" && uri.host != null && uri.userInfo == null)
            require(uri.rawQuery == null && uri.rawFragment == null &&
                (uri.path == null || uri.path.isBlank() || uri.path == "/"))
            require(uri.port in -1..65535)
            PublicRjStatusHttpsClient(URI("https",null,uri.host,uri.port,
                PUBLIC_RJ_STATUS_PATH,null,null))
        }.getOrNull()
    }
}
