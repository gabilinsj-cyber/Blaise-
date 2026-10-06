package br.com.blaise.rj.data

import br.com.blaise.rj.assistant.WeatherRequest
import br.com.blaise.rj.assistant.normalizedSpeech
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
        if (request.city.ibgeCode == 3304557 && AlertaRioObservationParser.stations.any { normalizedSpeech(it) == normalizedSpeech(request.localScope.orEmpty()) }) {
            val observation = AlertaRioObservationParser.parse(get("https://websempre.rio.rj.gov.br/estacoes/")).firstOrNull { normalizedSpeech(it.station) == normalizedSpeech(request.localScope.orEmpty()) }
                ?: return "Não consegui confirmar medição recente nessa estação do Alerta Rio."
            val parts = listOfNotNull(observation.temperatureC?.let { "Temperatura: ${format(it)} graus." },
                observation.humidityPercent?.let { "Umidade: ${format(it)} por cento." },
                observation.windKmh?.let { "Vento médio: ${format(it)} quilômetros por hora." })
            if (parts.isEmpty()) return "Não consegui confirmar valores disponíveis nessa estação."
            return "Estação ${observation.station}. ${parts.joinToString(" ")} Medição ${observation.observedAt.atZone(zone).format(DateTimeFormatter.ofPattern("dd/MM HH:mm"))}, horário de Brasília. Fonte: Alerta Rio. A medição representa a estação. Sensação térmica, UV, previsão de chuva, nebulosidade e rajadas não estão disponíveis nesta consulta."
        }
        val catalog = JSONArray(get("https://apitempo.inmet.gov.br/estacoes/T"))
        val station = (0 until catalog.length()).map { catalog.getJSONObject(it) }.firstOrNull {
            it.optString("SG_ESTADO") == "RJ" && it.optString("CD_SITUACAO") == "Operante" &&
                normalizedSpeech(it.optString("DC_NOME")) == normalizedSpeech(request.city.name)
        } ?: return "Não consegui confirmar uma estação INMET com medição local para ${request.city.name}. Não vou usar outra cidade como se fosse essa localidade."
        val code = station.getString("CD_ESTACAO")
        check(Regex("[A-Z][0-9]{3}").matches(code))
        val url = "https://apitempo.inmet.gov.br/estacao/${today.minusDays(1)}/$today/$code"
        val rows = JSONArray(get(url))
        val valid = (0 until rows.length()).map { rows.getJSONObject(it) }.mapNotNull { row ->
            OfficialWeatherParser.observedAt(row)?.let { time -> row to time }
        }.filter { Duration.between(it.second, Instant.now()).seconds in 0..7200 }.maxByOrNull { it.second }
            ?: return "Não consegui confirmar uma medição recente para ${request.city.name}. Dados antigos não serão apresentados como atuais."
        if (request.localScope != null) return "Encontrei a estação ${station.optString("DC_NOME")} ($code), mas não confirmei cobertura do Centro do Rio. Não vou apresentar essa medição como sendo do Centro."
        val row = valid.first
        val temperature = OfficialWeatherParser.number(row, "TEM_INS", -20.0, 55.0)
        val humidity = OfficialWeatherParser.number(row, "UMD_INS", 0.0, 100.0)
        val wind = OfficialWeatherParser.number(row, "VEN_VEL", 0.0, 100.0)?.times(3.6)
        val parts = mutableListOf<String>()
        temperature?.let { parts += "Temperatura observada: ${format(it)} graus." }
        humidity?.let { parts += "Umidade: ${format(it)} por cento." }
        wind?.let { parts += "Vento: ${format(it)} quilômetros por hora." }
        if (q.contains("termica") || q.contains("sensacao")) parts += "Sensação térmica indisponível nessa fonte; não vou substituir pela temperatura."
        if (parts.isEmpty()) return "Não consegui confirmar valores válidos na medição de ${request.city.name}."
        if (listOf("uv", "raio", "alerta", "deslizamento", "transito", "onda").any(q::contains)) parts += "Os demais dados solicitados ainda não estão disponíveis nesta consulta."
        return "${request.city.name}. ${parts.joinToString(" ")} Fonte: INMET, estação $code. Medição ${valid.second.atZone(zone).format(DateTimeFormatter.ofPattern("dd/MM HH:mm"))}, horário de Brasília. Dados brutos da estação."
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
