package br.com.blaise.rj.assistant

import br.com.blaise.rj.BuildConfig
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.time.Instant
import javax.net.ssl.HttpsURLConnection
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

/** Request-scoped opt-in HTTPS client. Never sends audio or admin question bank. */
object RjOnlineResearchClient {
    private const val PATH = "/v1/public/assistant/research"
    private const val MAX_RESPONSE_BYTES = 48 * 1024
    private val allowedScopes = setOf(
        "RIO_DE_JANEIRO", "SUDESTE_BRASIL", "ATLANTICO_SUL",
        "GLOBAL_CLIMA_RELEVANTE_RJ"
    )
    private fun endpoint(): URL? {
        if (!BuildConfig.BLAISE_RESEARCH_ENABLED) return null
        val base = runCatching { URI(BuildConfig.BLAISE_RJ_PUBLIC_STATUS_BASE_URL) }.getOrNull()
            ?: return null
        if (base.scheme != "https" || base.host.isNullOrBlank() ||
            base.rawUserInfo != null || base.port != -1) return null
        return URL(base.scheme, base.host, PATH)
    }
    fun isConfigured(): Boolean = endpoint() != null

    suspend fun answer(request: WeatherRequest): String? = withContext(Dispatchers.IO) {
        val url = endpoint() ?: return@withContext null
        val geography = request.researchGeography ?: "RIO_DE_JANEIRO"
        if (geography !in allowedScopes || request.question.isBlank() ||
            request.question.length > 600) return@withContext null
        var connection: HttpsURLConnection? = null
        try {
            connection = url.openConnection() as HttpsURLConnection
            connection.instanceFollowRedirects = false
            connection.requestMethod = "POST"
            connection.connectTimeout = 4000
            connection.readTimeout = 6000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cache-Control", "no-store")
            val data = JSONObject()
                .put("question", request.question)
                .put("geography", geography)
                .put("requestedAt", request.requestedAt.toString())
                .put("timeZone", "America/Sao_Paulo").toString().toByteArray(Charsets.UTF_8)
            if (data.size > 3500) return@withContext null
            connection.setFixedLengthStreamingMode(data.size)
            connection.outputStream.use { it.write(data) }
            if (connection.responseCode != HttpURLConnection.HTTP_OK) return@withContext null
            if (connection.contentLength > MAX_RESPONSE_BYTES) return@withContext null
            val bytes = connection.inputStream.use { input ->
                input.readNBytes(MAX_RESPONSE_BYTES + 1)
            }
            if (bytes.size > MAX_RESPONSE_BYTES) return@withContext null
            val result = JSONObject(bytes.toString(Charsets.UTF_8))
            if (result.optString("contract") != "BLAISE_RJ_RESEARCH_WITH_EVIDENCE_V1" ||
                result.optString("status") != "ANSWER_WITH_CITATIONS" ||
                result.optString("geography") != geography ||
                result.optBoolean("officialAlert", true)) return@withContext null
            val responseTime = runCatching { Instant.parse(result.getString("asOf")) }.getOrNull()
                ?: return@withContext null
            val age = Instant.now().epochSecond - responseTime.epochSecond
            if (age !in -60..600) return@withContext null
            val answer = result.optString("answer")
            if (answer.length !in 12..2400) return@withContext null
            val evidence = result.optJSONArray("evidence") ?: return@withContext null
            if (evidence.length() !in 1..8) return@withContext null
            val formatted = mutableListOf<String>()
            for (index in 0 until evidence.length()) {
                val item = evidence.optJSONObject(index) ?: return@withContext null
                val link = runCatching { URI(item.getString("url")) }.getOrNull()
                    ?: return@withContext null
                if (link.scheme != "https" || link.host.isNullOrBlank() ||
                    link.rawUserInfo != null) return@withContext null
                val issued = runCatching { Instant.parse(item.getString("issuedAt")) }.getOrNull()
                    ?: return@withContext null
                if (issued.isAfter(Instant.now().plusSeconds(60))) return@withContext null
                val name = item.optString("sourceId").takeIf { it.matches(Regex("[a-z0-9-]{3,30}")) }
                    ?: return@withContext null
                formatted += name + " • " + item.getString("issuedAt") + " • " + link
            }
            "Pesquisa Blaise IA • resposta com fontes (não é alerta oficial)\n" +
                answer + "\n\nFontes e datas:\n" + formatted.joinToString("\n")
        } catch (_: Exception) {
            null
        } finally {
            connection?.disconnect()
        }
    }
}
