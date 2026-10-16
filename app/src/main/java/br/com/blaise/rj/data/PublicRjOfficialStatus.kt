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
    val localClosedAt: Instant? = null,
) {
    fun current(now: Instant) = localClosedAt == null && id.isNotBlank() && event.isNotBlank() &&
        !sent.isAfter(now) && !onset.isAfter(now) && expires.isAfter(now) &&
        sourceUrl in setOf("https://apiprevmet3.inmet.gov.br/avisos/rss", "https://wis2bra.inmet.gov.br/data/") &&
        br.com.blaise.rj.core.AlertValidityPolicy.activeUntil(sent, expires).isAfter(now)
    fun localActiveUntil() = minOf(br.com.blaise.rj.core.AlertValidityPolicy.activeUntil(sent, expires), localClosedAt ?: expires)
    fun retainHistory(now: Instant) = now.isBefore(localActiveUntil().plusSeconds(br.com.blaise.rj.core.AlertValidityPolicy.HISTORY_SECONDS))
}

data class PublicWarningInventory(
    val sourceId: String, val checkedAt: Instant, val complete: Boolean,
    val recordKeys: Set<String>, val cancelledIds: Set<String> = emptySet(),
) {
    fun current(now: Instant) = !checkedAt.isAfter(now) && Duration.between(checkedAt, now).seconds in 0..300
    fun withdrawn(id: String, issued: Instant, now: Instant) = current(now) && !checkedAt.isBefore(issued) &&
        (id in cancelledIds || complete && "$id|${issued.toEpochMilli()}" !in recordKeys)
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
    val localClosedAt: Instant? = null,
) {
    fun current(now: Instant): Boolean =
        localClosedAt == null && id.matches(Regex("^\\d{1,4}/\\d{4}$")) &&
        !issuedAt.isAfter(now) && validUntil.isAfter(now) &&
        br.com.blaise.rj.core.AlertValidityPolicy.activeUntil(issuedAt, validUntil).isAfter(now) &&
        areas.isNotEmpty() && areas.all { it.isNotBlank() } &&
        (waveMinMeters == null && waveMaxMeters == null ||
            waveMinMeters != null && waveMaxMeters != null &&
            waveMinMeters.isFinite() && waveMaxMeters.isFinite() &&
            waveMinMeters > 0.0 && waveMinMeters <= waveMaxMeters && waveMaxMeters <= 30.0)
    fun localActiveUntil() = minOf(br.com.blaise.rj.core.AlertValidityPolicy.activeUntil(issuedAt, validUntil), localClosedAt ?: validUntil)
    fun retainHistory(now: Instant) = now.isBefore(localActiveUntil().plusSeconds(br.com.blaise.rj.core.AlertValidityPolicy.HISTORY_SECONDS))
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
        require(id in setOf("inmet", "cemaden-rj", "cemaden-national", "redemet"))
        require(name.isNotBlank() && name.length <= 90)
        require(state in setOf("CURRENT", "CURRENT_DEGRADED", "STALE",
            "UNAVAILABLE", "NOT_CONNECTED", "NOT_CONFIGURED",
            "AWAITING_SOURCE_REFRESH", "ERROR"))
        require(scope.length in 1..80)
        require(connectedProduct == null || connectedProduct ==
            if (id == "inmet") "avisos" else if (id == "cemaden-national") "alertas-abertos" else if (id == "redemet") "observacoes-aerodromo" else "risco-hidrologico")
    }
    fun currentlyConnected() =
        state in setOf("CURRENT", "CURRENT_DEGRADED") &&
        connectedProduct != null
}

data class AerodromeObservation(val stationId: String, val stationName: String, val ibge: Int,
    val observedAt: Instant, val airTemperatureC: Double?, val windSpeedKmh: Double?,
    val gustKmh: Double?, val qnhHpa: Double?) {
    fun current(now: Instant) = !observedAt.isAfter(now) && Duration.between(observedAt, now).seconds in 0..3600
}
data class AerodromeStatus(val state: String, val reason: String, val fetchedAt: Instant?,
    val observations: List<AerodromeObservation>) {
    fun current(now: Instant) = state in setOf("CURRENT", "CURRENT_DEGRADED") && fetchedAt != null &&
        !fetchedAt.isAfter(now) && Duration.between(fetchedAt, now).seconds in 0..300
}

data class NationalCemadenAlert(val id: String, val ibge: Int, val municipality: String,
    val event: String, val officialLevel: String, val openedAtRaw: String)
data class NationalCemadenStatus(val fetchedAt: Instant, val sourceUpdatedAt: Instant,
    val alerts: List<NationalCemadenAlert>) {
    fun current(now: Instant) = !fetchedAt.isAfter(now) && !sourceUpdatedAt.isAfter(now) &&
        Duration.between(fetchedAt, now).seconds in 0..300 &&
        Duration.between(sourceUpdatedAt, now).seconds in 0..300
}

data class OpenWeatherComplement(val calculatedAt: Instant, val fetchedAt: Instant,
    val temperatureC: Double?, val feelsLikeC: Double?, val humidityPercent: Double?,
    val windKmh: Double?, val gustKmh: Double?, val pressureHpa: Double?, val rainRateMmPerHour: Double?) {
    fun current(now: Instant) = listOf(calculatedAt, fetchedAt).all {
        !it.isAfter(now) && Duration.between(it, now).seconds in 0..300
    }
    fun summary(): String = listOfNotNull(
        temperatureC?.let { "temperatura $it °C" }, feelsLikeC?.let { "sensação informada $it °C" },
        humidityPercent?.let { "umidade $it%" }, windKmh?.let { "vento $it km/h" },
        gustKmh?.let { "rajada $it km/h" }, pressureHpa?.let { "pressão ao nível do mar $it hPa" },
        rainRateMmPerHour?.let { "taxa de chuva $it mm/h" }).joinToString(" • ")
}

data class CptecMarineForecastPoint(val validAt: Instant, val waveHeightM: Double?, val waveDirection: String?, val windKmh: Double?)
data class CptecMarineForecast(val fetchedAt: Instant, val publicationDate: java.time.LocalDate, val points: List<CptecMarineForecastPoint>) {
    fun current(now: Instant) = !fetchedAt.isAfter(now) && Duration.between(fetchedAt, now).seconds in 0..300 &&
        Duration.between(publicationDate.atStartOfDay(java.time.ZoneOffset.UTC).toInstant(), now).seconds in 0..172800 &&
        points.any { !it.validAt.isBefore(now) }
}
private fun parseCptecMarine(root: JSONObject): CptecMarineForecast? = runCatching {
    val row = root.optJSONObject("marineForecast") ?: return null
    require(row.getString("sourceId") == "cptec-rj-wave-forecast" && row.getString("ibge") == "3304557")
    require(row.getString("sourceUrl") == "https://servicos.cptec.inpe.br/XML/cidade/241/todos/tempos/ondas.xml")
    require(row.getString("kind") == "MODEL_FORECAST_NOT_OBSERVATION" && !row.getBoolean("publicationTimeKnown"))
    val rows = row.getJSONArray("forecasts")
    require(rows.length() in 1..56)
    val points = (0 until rows.length()).map { index ->
        val point = rows.getJSONObject(index)
        fun number(key: String, max: Double): Double? {
            if (point.isNull(key)) return null
            val value = point.getDouble(key)
            require(value.isFinite() && value in 0.0..max)
            return value
        }
        val direction = if(point.isNull("waveDirection")) null else point.getString("waveDirection").also {
            require(it in setOf("N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"))
        }
        CptecMarineForecastPoint(Instant.parse(point.getString("validAt")), number("waveHeightM",30.0), direction, number("windKmh",400.0))
    }
    require(points.map { it.validAt }.distinct().size == points.size)
    CptecMarineForecast(Instant.parse(row.getString("fetchedAt")), java.time.LocalDate.parse(row.getString("publicationDate")), points)
}.getOrNull()

data class PublicRjStatus(
    val generatedAt: Instant,
    val municipalities: List<PublicRjMunicipality>,
    val warnings: List<PublicRjWarning>,
    val marine: PublicRjMarine? = null,
    val sourceProducts: List<PublicRjSourceProduct> = emptyList(),
    val warningInventories: List<PublicWarningInventory> = emptyList(),
    val nationalAlerts: NationalCemadenStatus? = null,
    val aerodromeObservations: AerodromeStatus? = null,
    val openWeatherComplement: OpenWeatherComplement? = null,
    val cptecMarineForecast: CptecMarineForecast? = null,
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
        require(sourceProducts.size <= 4 &&
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

    fun suppressWithdrawn(history: List<PublicRjWarning>, marineHistory: List<PublicRjMarineWarning>): PublicRjStatus {
        val visible = warnings.filter { row -> history.none { it.id == row.id && it.sent == row.sent && it.localClosedAt != null } }
        val ids = visible.map { it.id }.toSet()
        return copy(warnings = visible, municipalities = municipalities.map { it.copy(warningIds = it.warningIds.filter(ids::contains)) },
            marine = marine?.let { current -> current.copy(warnings = current.warnings.filter { row -> marineHistory.none {
                it.id == row.id && it.issuedAt == row.issuedAt && it.localClosedAt != null
            } }) })
    }
}
sealed interface PublicRjStatusResult {
    data class Available(val snapshot: PublicRjStatus) : PublicRjStatusResult
    data object Unavailable : PublicRjStatusResult
}

object PublicRjStatusParser {
    fun parseOpenWeather(root: JSONObject): OpenWeatherComplement? {
        if(root.isNull("openWeatherComplement")) return null
        val row=root.getJSONObject("openWeatherComplement")
        require(row.getString("ibge")=="3304557" && row.getString("sourceUrl")=="https://openweathermap.org/")
        require(row.getString("kind")=="BLENDED_CURRENT_WEATHER" && !row.getBoolean("independentStationProven"))
        require(!row.getBoolean("mayIssueWarning") && row.isNull("rainAccumulationMm"))
        fun n(key:String,lo:Double,hi:Double):Double? = if(row.isNull(key)) null else row.getDouble(key).also {
            require(it.isFinite() && it in lo..hi)
        }
        return OpenWeatherComplement(Instant.parse(row.getString("calculatedAt")),Instant.parse(row.getString("fetchedAt")),
            n("temperatureC",-30.0,60.0),n("feelsLikeC",-50.0,80.0),n("humidityPercent",0.0,100.0),
            n("windKmh",0.0,400.0),n("gustKmh",0.0,500.0),n("pressureSeaLevelHpa",850.0,1100.0),n("rainRateMmPerHour",0.0,500.0))
    }

    fun parseAerodromes(root: JSONObject): AerodromeStatus? =
        if (root.isNull("aerodromeObservations")) null else root.getJSONObject("aerodromeObservations").let { info ->
            require(info.getString("sourceUrl") == "https://redemet.decea.mil.br/")
            val state = info.getString("state")
            require(state in setOf("CURRENT", "CURRENT_DEGRADED", "STALE", "UNAVAILABLE"))
            val rows = info.getJSONArray("observations")
            require(rows.length() <= 2)
            val observations = (0 until rows.length()).map { index ->
                val row = rows.getJSONObject(index)
                val code = row.getString("stationId")
                require(code in setOf("SBGL", "SBRJ") && row.getString("ibge") == "3304557")
                require(row.getString("sourceUrl") == "https://redemet.decea.mil.br/" &&
                    row.getString("scope") == "AERODROME_POINT_NOT_MUNICIPAL_MEAN")
                require(!row.getBoolean("providesRainfallAccumulation") && !row.getBoolean("providesHydrologicalRisk") &&
                    !row.getBoolean("providesMarineMeasurement"))
                fun optionalNumber(key: String, min: Double, max: Double): Double? =
                    if (row.isNull(key)) null else row.getDouble(key).also { require(it.isFinite() && it in min..max) }
                val name = row.getString("stationName")
                require(name == if (code == "SBGL") "Galeão" else "Santos Dumont")
                AerodromeObservation(code, name, 3304557, Instant.parse(row.getString("observedAt")),
                    optionalNumber("airTemperatureC", -80.0, 60.0), optionalNumber("windSpeedKmh", 0.0, 400.0),
                    optionalNumber("gustKmh", 0.0, 500.0), optionalNumber("qnhHpa", 850.0, 1100.0))
            }
            require(observations.map { it.stationId }.distinct().size == observations.size)
            AerodromeStatus(state, info.getString("reason").also { require(it.length <= 96) },
                if (info.isNull("fetchedAt")) null else Instant.parse(info.getString("fetchedAt")), observations)
        }

    fun parseNational(root: JSONObject): NationalCemadenStatus? {
        return if (root.isNull("nationalAlerts")) null else root.getJSONObject("nationalAlerts").let { info ->
            require(info.getString("sourceUrl") == "https://painelalertas.cemaden.gov.br/wsAlertas2")
            require(!info.getBoolean("absenceOfRiskProven") && !info.getBoolean("municipalRiskLevelProvided"))
            val rows = info.getJSONArray("alerts")
            require(rows.length() <= 64)
            val alerts = (0 until rows.length()).map { index ->
                val row = rows.getJSONObject(index)
                val code = row.getString("ibge").toInt()
                require(RioMunicipalities.byIbgeCode(code)?.name == row.getString("municipality"))
                val level = row.getString("officialLevel")
                require(level in setOf("Moderado", "Alto", "Muito Alto"))
                val event = row.getString("event")
                require(event.length in 1..160 && event.none { it.code < 32 || it == '<' || it == '>' })
                val id = row.getString("id")
                require(id.matches(Regex("^[0-9]{1,10}:33[0-9]{5}$")) && id.endsWith(":$code"))
                NationalCemadenAlert(id, code, row.getString("municipality"), event, level,
                    row.getString("openedAtRaw").also { require(it.length in 1..40) })
            }
            require(alerts.map { it.id }.distinct().size == alerts.size)
            NationalCemadenStatus(Instant.parse(info.getString("fetchedAt")),
                Instant.parse(info.getString("sourceUpdatedAt")), alerts)
        }
    }

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
        val marine: PublicRjMarine? = null // Legacy maritime payload excluded by project policy.
        // Older deployments omit "sources": never infer that a worker is
        // connected just because the enclosing HTTP response is fresh.
        val products = root.optJSONArray("sources")?.let { rows ->
            require(rows.length() <= 4)
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
        val inventories = root.optJSONArray("warningInventories")?.let { rows ->
            if (rows.length() > 2) emptyList() else (0 until rows.length()).mapNotNull { index -> runCatching {
                val row = rows.getJSONObject(index)
                val source = row.getString("sourceId")
                require(source in setOf("inmet", "chm"))
                require(row.getString("sourceUrl") in if (source == "inmet")
                    setOf("https://apiprevmet3.inmet.gov.br/avisos/rss", "https://wis2bra.inmet.gov.br/data/") else
                    setOf("https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo"))
                val keys = row.getJSONArray("recordKeys")
                val cancellations = row.getJSONArray("cancelledIds")
                require(keys.length() <= 64 && cancellations.length() <= 64)
                val recordKeys = (0 until keys.length()).map(keys::getString)
                val cancelled = (0 until cancellations.length()).map(cancellations::getString)
                require(recordKeys.all { it.length in 1..330 } && cancelled.all { it.length in 1..256 })
                PublicWarningInventory(source, Instant.parse(row.getString("checkedAt")),
                    row.getBoolean("complete"), recordKeys.toSet(), cancelled.toSet())
            }.getOrNull() }
        } ?: emptyList()
        val national = parseNational(root)
        return PublicRjStatus(Instant.parse(root.getString("generatedAt")),
            municipalities,warnings,marine,products,inventories,national,parseAerodromes(root),parseOpenWeather(root),parseCptecMarine(root))
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
