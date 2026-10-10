package br.com.blaise.rj.data

import br.com.blaise.rj.assistant.WeatherRequest
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

/** Official INMET and Alerta Rio endpoints; every answer revalidates measurement age. */
class OfficialWeatherClient {
    private val zone = ZoneId.of("America/Sao_Paulo")
    suspend fun currentCity(request: WeatherRequest): CityWeatherResult = withContext(Dispatchers.IO) {
        runCatching { currentCityBlocking(request) }.getOrElse {
            CityWeatherResult(request.city.ibgeCode, request.localScope,
                unavailableReason = "Não foi possível confirmar uma medição oficial recente para ${request.localScope ?: request.city.name}.")
        }
    }

    /** Separate station network: these readings never stand in for Centro or another municipality. */
    suspend fun currentRioStations(): List<CityWeatherObservation> = withContext(Dispatchers.IO) {
        try {
            val url = "https://websempre.rio.rj.gov.br/estacoes/"
            AlertaRioObservationParser.parse(get(url)).map { row ->
                CityWeatherObservation(3304557, row.station, "Alerta Rio", url, row.observedAt,
                    row.temperatureC, row.humidityPercent, row.windKmh, 1800)
            }.filter { it.current(Instant.now()) }
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Hourly chart feed from an officially listed INMET station IN Rio city.
     * Never substitute a nearby municipality or invent/interpolate missing hours.
     * A station named RIO DE JANEIRO is attempted before other expressly
     * Rio de Janeiro-labelled stations, and its real name remains visible.
     */
    suspend fun recentRioHourlySeries(): InmetHourlySeries? = withContext(Dispatchers.IO) {
        try {
            recentRioHourlySeriesBlocking()
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            null
        }
    }

    private fun recentRioHourlySeriesBlocking(): InmetHourlySeries? {
        val catalog = JSONArray(get("https://apitempo.inmet.gov.br/estacoes/T"))
        val stations = (0 until catalog.length()).map { catalog.getJSONObject(it) }
            .filter { station ->
                station.optString("SG_ESTADO") == "RJ" &&
                    station.optString("CD_SITUACAO") == "Operante" &&
                    normalizedSpeech(station.optString("DC_NOME")).startsWith("rio de janeiro") &&
                    Regex("[A-Z][0-9]{3}").matches(station.optString("CD_ESTACAO"))
            }
            .sortedWith(compareBy<JSONObject> {
                normalizedSpeech(it.optString("DC_NOME")) != "rio de janeiro"
            }.thenBy { it.optString("CD_ESTACAO") })
            .take(3)
        val utcToday = LocalDate.now(ZoneOffset.UTC)
        for (station in stations) {
            val code = station.optString("CD_ESTACAO")
            val name = station.optString("DC_NOME")
            val latitude = station.optString("VL_LATITUDE").replace(',', '.').toDoubleOrNull()
            val longitude = station.optString("VL_LONGITUDE").replace(',', '.').toDoubleOrNull()
            if (latitude == null || longitude == null) continue
            val url = "https://apitempo.inmet.gov.br/estacao/${utcToday.minusDays(1)}/$utcToday/$code"
            val readings = try {
                val response = JSONArray(get(url))
                if (response.length() !in 1..500) continue
                (0 until response.length()).mapNotNull { index ->
                    val item = response.getJSONObject(index)
                    val observedAt = OfficialWeatherParser.observedAt(item) ?: return@mapNotNull null
                    InmetHourlyPoint(
                        observedAt = observedAt,
                        temperatureC = OfficialWeatherParser.number(item, "TEM_INS", -30.0, 60.0),
                        rainfallMm = OfficialWeatherParser.number(item, "CHUVA", 0.0, 400.0),
                        windKmh = OfficialWeatherParser.number(item, "VEN_VEL", 0.0, 100.0)?.times(3.6),
                    )
                }.sortedByDescending { it.observedAt }.take(48)
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                continue
            }
            val series = InmetHourlySeries(code, "$name ($code)", url, latitude, longitude, readings)
            val now = Instant.now()
            if (InmetMetric.entries.any { series.recentPoints(it, now).isNotEmpty() }) return series
        }
        return null
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
                    it.temperatureC, it.humidityPercent, it.windKmh, 1800)
            })
        }
        val today = LocalDate.now(zone)
        val catalog = JSONArray(get("https://apitempo.inmet.gov.br/estacoes/T"))
        val station = (0 until catalog.length()).map { catalog.getJSONObject(it) }.firstOrNull {
            it.optString("SG_ESTADO") == "RJ" && it.optString("CD_SITUACAO") == "Operante" &&
                normalizedSpeech(it.optString("DC_NOME")) == normalizedSpeech(request.city.name)
        } ?: return CityWeatherResult(request.city.ibgeCode, scope,
            unavailableReason = "Nenhuma estação INMET local confirmada para ${request.city.name}. Não é usada uma cidade vizinha como substituta.")
        val code = station.getString("CD_ESTACAO")
        check(Regex("[A-Z][0-9]{3}").matches(code))
        val url = "https://apitempo.inmet.gov.br/estacao/${today.minusDays(1)}/$today/$code"
        val rows = JSONArray(get(url))
        val instant = Instant.now()
        val valid = (0 until rows.length()).map { rows.getJSONObject(it) }.mapNotNull { row ->
            OfficialWeatherParser.observedAt(row)?.let { row to it }
        }.filter { Duration.between(it.second, instant).seconds in 0..7200 }.maxByOrNull { it.second }
            ?: return CityWeatherResult(request.city.ibgeCode, scope,
                unavailableReason = "Sem medição INMET recente confirmada para ${request.city.name}.")
        if (scope != null) return CityWeatherResult(request.city.ibgeCode, scope,
            unavailableReason = "Cobertura de $scope não confirmada pela estação INMET $code.")
        return CityWeatherResult(request.city.ibgeCode, scope, CityWeatherObservation(
            request.city.ibgeCode, "${station.optString("DC_NOME")} ($code)", "INMET", url, valid.second,
            OfficialWeatherParser.number(valid.first, "TEM_INS", -20.0, 55.0),
            OfficialWeatherParser.number(valid.first, "UMD_INS", 0.0, 100.0),
            OfficialWeatherParser.number(valid.first, "VEN_VEL", 0.0, 100.0)?.times(3.6), 7200,
        ))
    }
    suspend fun answer(request: WeatherRequest, severity: Int = 1): String = withContext(Dispatchers.IO) {
        // The bulletin scheduler controls polling frequency. Do not cache rendered answers:
        // retrieval age cannot extend the validity of the underlying observation.
        val result = runCatching { query(request) }.getOrElse {
            "Não consegui confirmar os dados oficiais de ${request.localScope ?: request.city.name} agora. A consulta ao INMET está indisponível. Não tenho temperatura ou sensação térmica válida para informar. Tente novamente em instantes."
        }
        result
    }
    private fun get(url: String): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 8000; conn.readTimeout = 8000; conn.instanceFollowRedirects = false
        conn.setRequestProperty("Accept", "application/json")
        try {
            check(conn.responseCode == 200)
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
