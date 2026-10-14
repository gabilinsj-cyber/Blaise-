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
        Duration.between(observedAt, now).seconds in 0..300
}

data class PublicRjWarning(
    val id: String, val event: String, val severity: String,
    val sent: Instant, val onset: Instant, val expires: Instant,
    val municipalityIbges: List<Int>,
    val sourceUrl: String,
) {
    fun current(now: Instant) = id.isNotBlank() && event.isNotBlank() &&
        !sent.isAfter(now) && !onset.isAfter(now) && expires.isAfter(now) &&
        sourceUrl == "https://apiprevmet3.inmet.gov.br/avisos/rss" &&
        br.com.blaise.rj.core.AlertValidityPolicy.activeUntil(sent, expires).isAfter(now)
}
data class PublicRjMunicipality(
    val ibge: Int, val name: String, val risk: PublicRjRisk?,
    val warningIds: List<String>, val warningCoverage: String,
)
/**
 * An official CHM warning for a REGION of METAREA V, never a mapped RJ
 * municipality. Warnings must not be converted into automatic local P0.
 */
data class PublicRjMarineWarning(
    val id: String,
    val warningType: String,
    val issuedAt: Instant,
    val validUntil: Instant,
    val areas: List<String>,
    val waveMinMeters: Double?,
    val waveMaxMeters: Double?,
    val waveDirection: String?,
    val officialRessacaLabel: Boolean,
) {
    fun current(now: Instant): Boolean =
        id.matches(Regex("^\\d{1,4}/\\d{4}$")) &&
        !issuedAt.isAfter(now) && validUntil.isAfter(now) &&
        br.com.blaise.rj.core.AlertValidityPolicy.activeUntil(issuedAt, validUntil).isAfter(now) &&
        areas.isNotEmpty() && areas.all { it.isNotBlank() } &&
        (waveMinMeters == null && waveMaxMeters == null ||
            waveMinMeters != null && waveMaxMeters != null &&
            waveMinMeters.isFinite() && waveMaxMeters.isFinite() &&
            waveMinMeters > 0.0 && waveMinMeters <= waveMaxMeters && waveMaxMeters <= 30.0)
}

data class PublicRjMarine(
    val fetchedAt: Instant,
    val sourceUrl: String,
    val warnings: List<PublicRjMarineWarning>,
) {
    fun current(now: Instant): Boolean =
        sourceUrl == "https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo" &&
        !fetchedAt.isAfter(now) && Duration.between(fetchedAt, now).seconds in 0..300
}

/**
 * Verified worker state for one SPECIFIC official product, never a claim that
 * the complete provider has every weather variable for every RJ municipality.
 * Backend allows only INMET (CAP warnings) and CEMADEN-RJ (hydro risk) here.
 */
data class PublicRjSourceProduct(
    val id: String,
    val name: String,
    val state: String,
    val connectedProduct: String?,
    val scope: String,
) {
    init {
        require(id in setOf("inmet", "cemaden-rj"))
        require(name.isNotBlank() && name.length <= 90)
        require(state in setOf("CURRENT", "CURRENT_DEGRADED", "STALE",
            "UNAVAILABLE", "NOT_CONNECTED", "NOT_CONFIGURED",
            "AWAITING_SOURCE_REFRESH", "ERROR"))
        require(scope.length in 1..80)
        require(connectedProduct == null || connectedProduct ==
            if (id == "inmet") "avisos" else "risco-hidrologico")
    }
    fun currentlyConnected() =
        state in setOf("CURRENT", "CURRENT_DEGRADED") &&
        connectedProduct != null
}

data class PublicRjStatus(
    val generatedAt: Instant,
    val municipalities: List<PublicRjMunicipality>,
    val warnings: List<PublicRjWarning>,
    val marine: PublicRjMarine? = null,
    val sourceProducts: List<PublicRjSourceProduct> = emptyList(),
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
        require(marine == null || marine.warnings.size <= 16 &&
            marine.warnings.map { it.id }.distinct().size == marine.warnings.size)
        require(sourceProducts.size <= 2 &&
            sourceProducts.map { it.id }.distinct().size == sourceProducts.size)
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
        // Older public-status deployments are backwards compatible and have
        // no marine object. Do not synthesize a warning from an empty feed.
        val marine = root.optJSONObject("marine")?.let { sea ->
            require(sea.getString("sourceId") == "chm-marine")
            require(sea.getString("scope") == "METAREA_V_RJ_REGIONAL_NOT_MUNICIPAL")
            require(!sea.getBoolean("municipalityGeofenceValidated"))
            require(sea.getBoolean("noWarningsDoesNotMeanSafe"))
            val waveList = sea.getJSONArray("warnings")
            require(waveList.length() <= 16 && sea.getInt("warningCount") == waveList.length())
            val warningRows=(0 until waveList.length()).map { idx ->
                val w=waveList.getJSONObject(idx)
                require(!w.getBoolean("municipalityGeofenceValidated") &&
                    !w.getBoolean("mayIssueMunicipalP0"))
                val regionList=w.getJSONArray("areas")
                require(regionList.length() in 1..8)
                val areas=(0 until regionList.length()).map { regionIndex ->
                    regionList.getString(regionIndex).also {
                        require(it.isNotBlank() && it.length<=48)
                    }
                }
                val hasWave=!w.isNull("waveMinMeters") && !w.isNull("waveMaxMeters")
                val min=if(hasWave) w.getDouble("waveMinMeters") else null
                val max=if(hasWave) w.getDouble("waveMaxMeters") else null
                require((min == null && max == null) || (min != null && max != null &&
                    min.isFinite() && max.isFinite() && min>0.0 && max>=min && max<=30.0))
                val direction=if (w.isNull("waveDirection")) null else w.getString("waveDirection")
                require((min==null)==(direction==null))
                if(direction!=null) require(direction.matches(Regex("^[NSEW/]{1,7}$")))
                val exceeded=if(w.isNull("waveThresholdExceeded")) null else w.getBoolean("waveThresholdExceeded")
                require(exceeded==(max?.let { it>3.5 }))
                PublicRjMarineWarning(
                    w.getString("id"),w.getString("warningType"),
                    Instant.parse(w.getString("issuedAt")),Instant.parse(w.getString("validUntil")),
                    areas,min,max,direction,w.getBoolean("officialRessacaLabel"),
                ).also { require(it.id.matches(Regex("^\\d{1,4}/\\d{4}$")) &&
                    it.warningType.length in 3..96 && it.validUntil>it.issuedAt) }
            }
            PublicRjMarine(Instant.parse(sea.getString("fetchedAt")),
                sea.getString("sourceUrl"),warningRows).also {
                require(it.sourceUrl ==
                    "https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo")
            }
        }
        // Older deployments omit "sources": never infer that a worker is
        // connected just because the enclosing HTTP response is fresh.
        val products = root.optJSONArray("sources")?.let { rows ->
            require(rows.length() <= 2)
            (0 until rows.length()).map { idx ->
                val item = rows.getJSONObject(idx)
                val product=if(item.isNull("connectedProduct")) null
                    else item.getString("connectedProduct")
                val reportedState=item.getString("state")
                // A newer backend may have added a worker status. Unknown
                // states never elevate source evidence, and must not suppress
                // otherwise valid public INMET/CHM warnings for the user.
                val recognizedStates=setOf("CURRENT", "CURRENT_DEGRADED",
                    "STALE", "UNAVAILABLE", "NOT_CONNECTED",
                    "NOT_CONFIGURED", "AWAITING_SOURCE_REFRESH", "ERROR")
                val safeState=if(reportedState in recognizedStates)
                    reportedState else "NOT_CONNECTED"
                PublicRjSourceProduct(
                    id=item.getString("id"), name=item.getString("name"),
                    state=safeState,
                    connectedProduct=product, scope=item.getString("scope"),
                )
            }
        } ?: emptyList()
        return PublicRjStatus(Instant.parse(root.getString("generatedAt")),
            municipalities,warnings,marine,products)
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
