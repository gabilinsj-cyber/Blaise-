package br.com.blaise.rj.billing

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.util.concurrent.Executor
import java.util.concurrent.Executors

object VerifierEndpointPolicy {
    fun normalizedHttpsUrl(value: String): String? {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return null
        val uri = runCatching { URI(trimmed) }.getOrNull() ?: return null
        if (!uri.scheme.equals("https", ignoreCase = true) || uri.host.isNullOrBlank()) return null
        if (uri.userInfo != null) return null
        return uri.toString()
    }
}

object PurchaseVerifierFactory {
    fun create(endpoint: String, packageName: String): PurchaseVerifier {
        val normalized = VerifierEndpointPolicy.normalizedHttpsUrl(endpoint) ?: return FailClosedPurchaseVerifier
        return HttpsPurchaseVerifier(normalized, packageName)
    }
}

class HttpsPurchaseVerifier(
    endpoint: String,
    private val packageName: String,
    private val executor: Executor = sharedExecutor,
) : PurchaseVerifier {
    private val endpointUrl: URL = URL(requireNotNull(VerifierEndpointPolicy.normalizedHttpsUrl(endpoint)))

    override fun verify(candidate: PlayPurchaseCandidate, callback: (ServerVerification) -> Unit) {
        executor.execute {
            callback(runCatching { verifyBlocking(candidate) }.getOrDefault(ServerVerification.UNAVAILABLE))
        }
    }

    private fun verifyBlocking(candidate: PlayPurchaseCandidate): ServerVerification {
        val connection = endpointUrl.openConnection() as? HttpURLConnection ?: return ServerVerification.UNAVAILABLE
        return try {
            connection.instanceFollowRedirects = false
            connection.requestMethod = "POST"
            connection.connectTimeout = 7_000
            connection.readTimeout = 7_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cache-Control", "no-store")

            val payload = JSONObject()
                .put("packageName", packageName)
                .put("purchaseToken", candidate.purchaseToken)
                .put("productIds", JSONArray(candidate.productIds))
                .toString()
                .toByteArray(Charsets.UTF_8)
            connection.setFixedLengthStreamingMode(payload.size)
            connection.outputStream.use { it.write(payload) }

            if (connection.responseCode !in 200..299) return ServerVerification.UNAVAILABLE
            val body = readBoundedUtf8(connection, 8_192) ?: return ServerVerification.UNAVAILABLE
            val json = runCatching { JSONObject(body) }.getOrNull() ?: return ServerVerification.UNAVAILABLE
            if (json.optBoolean("active", false)) ServerVerification.VERIFIED_ACTIVE else ServerVerification.REJECTED
        } finally {
            connection.disconnect()
        }
    }

    private fun readBoundedUtf8(connection: HttpURLConnection, maxChars: Int): String? {
        val reader = connection.inputStream.bufferedReader(Charsets.UTF_8)
        return reader.use {
            val buffer = CharArray(1_024)
            val output = StringBuilder()
            while (true) {
                val read = it.read(buffer)
                if (read < 0) break
                if (output.length + read > maxChars) return null
                output.append(buffer, 0, read)
            }
            output.toString()
        }
    }

    companion object {
        private val sharedExecutor = Executors.newCachedThreadPool { runnable ->
            Thread(runnable, "blaise-entitlement-verifier").apply { isDaemon = true }
        }
    }
}
