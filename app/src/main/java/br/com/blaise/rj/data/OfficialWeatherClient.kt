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

    // Several municipality cards and the chart can refresh concurrently.
    // The official INMET station CATALOG changes far less frequently than
    // measurements; fetch it once per hour, without extending measurement
    // freshness or manufacturing coverage for municipalities without a station.
    private val inmetCatalogLock = Any()
    private var inmetCatalogCachedAtMs = 0L
    private var inmetCatalogCache: List<InmetCatalogStation>? = null

    private fun inmetCatalogEntries(): List<InmetCatalogStation> =
        synchronized(inmetCatalogLock) {
            val at = System.currentTimeMillis()
            val cached = inmetCatalogCache
            if (cached != null && at - inmetCatalogCachedAtMs in 0..3_600_000L) {
                return@synchronized cached
            }
            val array = JSONArray(get("https://apitempo.inmet.gov.br/estacoes/T"))
            require(array.length() in 1..2000)
            val entries = (0 until array.length()).mapNotNull { index ->
                val row = array.optJSONObject(index) ?: return@mapNotNull null
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
            inmetCatalogCache = entries
            inmetCatalogCachedAtMs = at
            entries
        }

    private fun recentMunicipalityHourlySeriesBlocking(city: City): InmetHourlySeries? {
        if (br.com.blaise.rj.cities.RioMunicipalities.byIbgeCode(city.ibgeCode)?.name != city.name)
            return null
        val stations = InmetMunicipalityStationPolicy.select(city, inmetCatalogEntries())
        val utcToday = LocalDate.now(ZoneOffset.UTC)
        for (station in stations) {
            val code = station.code
            val name = station.name
            val latitude = station.latitude ?: continue
            val longitude = station.longitude ?: continue
            val url = "https://apitempo.inmet.gov.br/estacao/${utcToday.minusDays(1)}/$utcToday/$code"
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
        val city = request.city
        val scope = request.localScope
        // Fail closed if a caller passes an out-of-state code or mismatched name.
        if (br.com.blaise.rj.cities.RioMunicipalities.byIbgeCode(city.ibgeCode)?.name != city.name) {
            return CityWeatherResult(city.ibgeCode, scope,
                unavailableReason = "Cidade fora do cadastro dos 92 municípios do RJ.")
        }
        if (scope != null) {
            // Alerta Rio stations are neighbourhood point measurements, never
            // automatically interchangeable with an entire municipality.
            if (city.ibgeCode != 3304557 ||
                AlertaRioObservationParser.stations.none {
                    normalizedSpeech(it) == normalizedSpeech(scope)
                }) {
                return CityWeatherResult(city.ibgeCode, scope,
                    unavailableReason = "Estação ou cobertura de $scope não confirmada para ${city.name}.")
            }
            val url = "https://websempre.rio.rj.gov.br/estacoes/"
            val row = AlertaRioObservationParser.parse(get(url)).firstOrNull {
                normalizedSpeech(it.station) == normalizedSpeech(scope)
            }
            return CityWeatherResult(city.ibgeCode, scope, row?.let {
                CityWeatherObservation(city.ibgeCode, it.station, "Alerta Rio", url,
                    it.observedAt, it.temperatureC, it.humidityPercent, it.windKmh, 1800)
            })
        }

        // Reuse the same exact-municipality, operational, georeferenced
        // station policy as the INMET graph; never substitute nearby cities.
        val stations = InmetMunicipalityStationPolicy.select(city, inmetCatalogEntries())
        if (stations.isEmpty()) {
            return CityWeatherResult(city.ibgeCode, null,
                unavailableReason = "Nenhuma estação INMET operacional com localização municipal comprovada em ${city.name}.")
        }
        val utc = LocalDate.now(ZoneOffset.UTC)
        val now = Instant.now()
        for (station in stations) {
            val url = "https://apitempo.inmet.gov.br/estacao/${utc.minusDays(1)}/$utc/${station.code}"
            val result = try {
                val rows = JSONArray(get(url))
                if (rows.length() !in 1..500) continue
                val valid = (0 until rows.length()).mapNotNull { index ->
                    val row = rows.optJSONObject(index) ?: return@mapNotNull null
                    if (row.optString("CD_ESTACAO", station.code) != station.code)
                        return@mapNotNull null
                    val at = OfficialWeatherParser.observedAt(row) ?: return@mapNotNull null
                    if (Duration.between(at, now).seconds !in 0..7200) return@mapNotNull null
                    row to at
                }.sortedByDescending { it.second }
                valid.firstNotNullOfOrNull { (data, at) ->
                    CityWeatherObservation(
                        city.ibgeCode,
                        "${station.name} (${station.code})",
                        "INMET",
                        url,
                        at,
                        OfficialWeatherParser.number(data, "TEM_INS", -30.0, 60.0),
                        OfficialWeatherParser.number(data, "UMD_INS", 0.0, 100.0),
                        OfficialWeatherParser.number(data, "VEN_VEL", 0.0, 100.0)?.times(3.6),
                        7200,
                        windGustKmh = OfficialWeatherParser.number(data, "VEN_RAJ", 0.0, 111.11)?.times(3.6),
                        hourlyRainMm = OfficialWeatherParser.number(data, "CHUVA", 0.0, 400.0),
                        stationLatitude = station.latitude,
                        stationLongitude = station.longitude,
                    ).takeIf { it.current(now) }
                }
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                // A different eligible INMET station may still have fresh
                // observations. Continue without inventing a source.
                null
            }
            if (result != null) return CityWeatherResult(city.ibgeCode, null, result)
        }
        return CityWeatherResult(city.ibgeCode, null,
            unavailableReason = "Não há observação INMET atual e válida nas estações identificadas de ${city.name}.")
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
