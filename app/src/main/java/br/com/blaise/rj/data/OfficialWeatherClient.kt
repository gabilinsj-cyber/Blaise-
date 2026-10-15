package br.com.blaise.rj.data

import br.com.blaise.rj.assistant.WeatherRequest
import br.com.blaise.rj.core.City
import br.com.blaise.rj.assistant.normalizedSpeech
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.*
import java.time.format.DateTimeFormatter
import java.util.Locale

private class OfficialWeatherSourceFailure(val code: String) : java.io.IOException(code)

/** Official INMET and Alerta Rio endpoints; every answer revalidates measurement age. */
class OfficialWeatherClient {
    private val zone = ZoneId.of("America/Sao_Paulo")
    suspend fun currentCity(request: WeatherRequest): CityWeatherResult = withContext(Dispatchers.IO) {
        try {
            currentCityBlocking(request)
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            CityWeatherResult(request.city.ibgeCode, request.localScope,
                unavailableReason = "Não foi possível confirmar uma medição oficial recente para ${request.localScope ?: request.city.name}.")
        }
    }

    /** One acquisition feeds cards, charts, map and assistant for this municipality. */
    suspend fun citySnapshot(request: WeatherRequest): MunicipalWeatherSnapshot = withContext(Dispatchers.IO) {
        try {
            if (request.localScope != null) {
                MunicipalWeatherSnapshot(currentCityBlocking(request), null, Instant.now())
            } else {
                val failures = mutableListOf<String>()
                val series = recentMunicipalityHourlySeriesBlocking(request.city) { failures.add(it) }
                val snapshot = MunicipalWeatherSnapshot.fromSeries(request.city.ibgeCode, series, Instant.now())
                snapshot.copy(sourceFailures = failures.toList(), failureCode = if(snapshot.report.observation == null)
                    failures.lastOrNull() ?: "NO_CURRENT_LOCAL_MEASUREMENT" else null)
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            MunicipalWeatherSnapshot(CityWeatherResult(request.city.ibgeCode, request.localScope,
                unavailableReason = "Fonte indisponível para este município; nenhum dado foi inventado."), null, Instant.now(), sourceFailureCode(error))
        }
    }

    /** Separate station network: these readings never stand in for Centro or another municipality. */
    suspend fun currentRioStations(): List<CityWeatherObservation> = withContext(Dispatchers.IO) {
        try {
            val url = "https://websempre.rio.rj.gov.br/estacoes/"
            AlertaRioObservationParser.parse(get(url)).map { row ->
                CityWeatherObservation(3304557, row.station, "Alerta Rio", url, row.observedAt,
                    row.temperatureC, row.humidityPercent, row.windKmh, 300)
            }.filter { it.current(Instant.now()) }
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Real INMET hourly series for a station officially cataloged inside the
     * SELECTED RJ municipality. If there is no exact station match or current
     * readings, the graph remains unavailable. Never borrow another city.
     */
    suspend fun recentMunicipalityHourlySeries(city: City): InmetHourlySeries? =
        withContext(Dispatchers.IO) {
            try {
                recentMunicipalityHourlySeriesBlocking(city)
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                null
            }
        }

    /** Kept for any old Rio-only callers; uses exactly the same validated path. */
    suspend fun recentRioHourlySeries(): InmetHourlySeries? =
        recentMunicipalityHourlySeries(City("Rio de Janeiro", 3304557))

    private fun recentMunicipalityHourlySeriesBlocking(city: City, onFailure: (String) -> Unit = {}): InmetHourlySeries? {
        if (br.com.blaise.rj.cities.RioMunicipalities.byIbgeCode(city.ibgeCode)?.name != city.name)
            return null
        val catalogJson = JSONArray(get("https://apitempo.inmet.gov.br/estacoes/T"))
        if (catalogJson.length() !in 1..2000) return null
        val entries = (0 until catalogJson.length()).mapNotNull { index ->
            val row = catalogJson.optJSONObject(index) ?: return@mapNotNull null
            fun coordinate(key: String) =
                row.optString(key).replace(',', '.').toDoubleOrNull()
            InmetCatalogStation(
                code = row.optString("CD_ESTACAO"),
                name = row.optString("DC_NOME"),
                state = row.optString("SG_ESTADO"),
                provider = row.optString("SG_ENTIDADE"),
                operationalStatus = row.optString("CD_SITUACAO"),
                latitude = coordinate("VL_LATITUDE"),
                longitude = coordinate("VL_LONGITUDE"),
            )
        }
        val stations = InmetMunicipalityStationPolicy.select(city, entries)
        val utcToday = LocalDate.now(ZoneOffset.UTC)
        var historicalFallback: InmetHourlySeries? = null
        for (station in stations) {
            val code = station.code
            val name = station.name
            val latitude = station.latitude ?: continue
            val longitude = station.longitude ?: continue
            val url = "https://apitempo.inmet.gov.br/estacao/${utcToday.minusDays(7)}/$utcToday/$code"
            val readings = try {
                val response = JSONArray(get(url))
                if (response.length() !in 1..500) continue
                (0 until response.length()).mapNotNull { index ->
                    val item = response.getJSONObject(index)
                    if (item.optString("CD_ESTACAO", code) != code) return@mapNotNull null
                    val observedAt = OfficialWeatherParser.observedAt(item) ?: return@mapNotNull null
                    InmetHourlyPoint(
                        observedAt = observedAt,
                        temperatureC = OfficialWeatherParser.number(item, "TEM_INS", -30.0, 60.0),
                        rainfallMm = OfficialWeatherParser.number(item, "CHUVA", 0.0, 400.0),
                        windKmh = OfficialWeatherParser.number(item, "VEN_VEL", 0.0, 100.0)?.times(3.6),
                        humidityPercent = OfficialWeatherParser.number(item, "UMD_INS", 0.0, 100.0),
                        windGustKmh = OfficialWeatherParser.number(item, "VEN_RAJ", 0.0, 111.11)?.times(3.6),
                    )
                }.filter { !it.observedAt.isAfter(Instant.now()) }
                    .distinctBy { it.observedAt }
                    .sortedByDescending { it.observedAt }.take(192)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                onFailure(sourceFailureCode(error))
                continue
            }
            val series = InmetHourlySeries(code, "$name ($code)", url, latitude, longitude, readings, city.ibgeCode)
            val now = Instant.now()
            if (series.trustedMetadata()) {
                if (MunicipalWeatherSnapshot.fromSeries(city.ibgeCode, series, now).report.currentObservation(now) != null) return series
                onFailure("SOURCE_DELAYED_OR_EMPTY")
                if (historicalFallback == null && series.points.any { !it.observedAt.isAfter(now) }) historicalFallback = series
            }
        }
        return historicalFallback
    }

    private fun currentCityBlocking(request: WeatherRequest): CityWeatherResult {
        val scope = request.localScope
        if (request.city.ibgeCode == 3304557 && scope != null) {
            if (AlertaRioObservationParser.stations.none { normalizedSpeech(it) == normalizedSpeech(scope) }) {
                return CityWeatherResult(request.city.ibgeCode, scope,
                    unavailableReason = "Não há medição de $scope confirmada nesta consulta. Informe uma estação para consultar sua área de cobertura.")
            }
            val url = "https://websempre.rio.rj.gov.br/estacoes/"
            val row = AlertaRioObservationParser.parse(get(url)).firstOrNull { normalizedSpeech(it.station) == normalizedSpeech(scope) }
            return CityWeatherResult(request.city.ibgeCode, scope, row?.let {
                CityWeatherObservation(request.city.ibgeCode, it.station, "Alerta Rio", url, it.observedAt,
                    it.temperatureC, it.humidityPercent, it.windKmh, 300)
            })
        }
        if (scope != null) return CityWeatherResult(request.city.ibgeCode, scope,
            unavailableReason = "Cobertura de $scope não confirmada por uma estação local.")
        // Use the same station policy, fallback sequence and age validation as
        // the cards, charts and map instead of selecting the first catalog row.
        val series = recentMunicipalityHourlySeriesBlocking(request.city)
        return MunicipalWeatherSnapshot.fromSeries(request.city.ibgeCode, series, Instant.now()).report
    }

    suspend fun answer(request: WeatherRequest, severity: Int = 1): String = withContext(Dispatchers.IO) {
        // The bulletin scheduler controls polling frequency. Do not cache rendered answers:
        // retrieval age cannot extend the validity of the underlying observation.
        val result = try {
            query(request)
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            "Não consegui confirmar os dados oficiais de ${request.localScope ?: request.city.name} agora. A consulta ao INMET está indisponível. Não tenho temperatura ou sensação térmica válida para informar. Tente novamente em instantes."
        }
        result
    }
    private fun sourceFailureCode(error: Exception): String = when(error) {
        is OfficialWeatherSourceFailure -> error.code
        is java.net.SocketTimeoutException -> "SOURCE_TIMEOUT"
        is org.json.JSONException -> "INVALID_SOURCE_RESPONSE"
        is java.io.IOException -> "SOURCE_NETWORK_ERROR"
        else -> "SOURCE_VALIDATION_FAILED"
    }

    private fun get(url: String): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 8000; conn.readTimeout = 8000; conn.instanceFollowRedirects = false
        conn.setRequestProperty("Accept", "application/json")
        try {
            if (conn.responseCode != 200) throw OfficialWeatherSourceFailure("HTTP_${conn.responseCode}")
            return conn.inputStream.use { input ->
                val output = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    check(output.size() + count <= 2 * 1024 * 1024)
                    output.write(buffer, 0, count)
                }
                val bytes = output.toByteArray()
                bytes.toString(Charsets.UTF_8)
            }
        } finally { conn.disconnect() }
    }
    private fun query(request: WeatherRequest): String {
        val today = LocalDate.now(zone)
        if (request.date != today) return forecast(request)
        val q = normalizedSpeech(request.question)
        if (listOf("vai", "previsao", "maxima", "minima", "fim do dia", "tarde", "praia", "quando").any(q::contains)) return forecast(request)
        val observation = currentCityBlocking(request)
        val summary = observation.summary(Instant.now())
        if (observation.currentObservation(Instant.now()) == null) return summary
        val otherTopics = if (listOf("ciclone", "alerta", "granizo", "deslizamento", "onda", "tsunami", "transito").any(q::contains)) " Os demais fenômenos e alertas solicitados também estão indisponíveis." else ""
        return "$summary A medição representa a estação. Sensação térmica, UV, previsão de chuva, nebulosidade e rajadas não estão disponíveis nesta consulta.$otherTopics"
    }
    private fun forecast(request: WeatherRequest): String {
        val url = "https://apiprevmet3.inmet.gov.br/previsao/${request.city.ibgeCode}"
        val root = JSONObject(get(url)).getJSONObject(request.city.ibgeCode.toString())
        val day = root.optJSONObject(request.date.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")))
            ?: return "Não consegui confirmar previsão do INMET para ${request.city.name} em ${request.date}."
        val periods = listOf("manha", "tarde", "noite").mapNotNull { day.optJSONObject(it) }.ifEmpty { listOf(day) }
        val values = periods.mapNotNull { part ->
            val min = OfficialWeatherParser.number(part, "temp_min", -20.0, 55.0)
            val max = OfficialWeatherParser.number(part, "temp_max", -20.0, 55.0)
            val condition = part.optString("resumo").takeIf { it.isNotBlank() && it.length <= 400 }
            if (min == null && max == null && condition == null) null else listOfNotNull(
                min?.let { "mínima ${format(it)} graus" }, max?.let { "máxima ${format(it)} graus" }, condition
            ).joinToString(", ")
        }
        if (values.isEmpty()) return "Não consegui confirmar valores válidos na previsão de ${request.city.name}."
        // Without an issuance timestamp, never describe this payload as a validated current forecast.
        return "Recebi um conteúdo de previsão do INMET para ${request.city.name}, mas a resposta não trouxe horário de emissão validado. Não posso confirmar que é a previsão mais recente. Sensação térmica indisponível."
    }
    private fun format(value: Double) = String.format(Locale("pt", "BR"), "%.1f", value)
}
object OfficialWeatherParser {
    fun number(row: JSONObject, key: String, min: Double, max: Double): Double? =
        row.optString(key).replace(',', '.').toDoubleOrNull()?.takeIf { it.isFinite() && it in min..max && it != 9999.0 }
    fun observedAt(row: JSONObject): Instant? = runCatching {
        val date = LocalDate.parse(row.getString("DT_MEDICAO").take(10))
        val hour = row.getString("HR_MEDICAO").padStart(4, '0')
        date.atTime(hour.take(2).toInt(), hour.takeLast(2).toInt()).toInstant(ZoneOffset.UTC)
    }.getOrNull()
}
