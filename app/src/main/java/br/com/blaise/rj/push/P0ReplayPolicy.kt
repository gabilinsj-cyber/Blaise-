package br.com.blaise.rj.push

import java.security.MessageDigest
import java.time.Instant
import java.util.LinkedHashMap

/**
 * Pure replay-window policy for official P0 alert identifiers.
 * Only a SHA-256 fingerprint and expiry are retained; raw alert IDs are not persisted.
 */
object P0ReplayPolicy {
    const val RETENTION_SECONDS: Long = 24 * 60 * 60
    const val MAX_ENTRIES: Int = 256

    data class Decision(
        val accepted: Boolean,
        val entries: Map<String, Long>,
    )

    fun fingerprint(alertId: String): String {
        require(alertId.isNotBlank() && alertId.length <= 256) { "invalid_p0_alert_id" }
        val digest = MessageDigest.getInstance("SHA-256").digest(alertId.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    fun evaluate(
        existingEntries: Map<String, Long>,
        alertId: String,
        now: Instant,
    ): Decision {
        val nowEpochSecond = now.epochSecond
        val key = fingerprint(alertId)
        val validEntries = existingEntries
            .asSequence()
            .filter { (fingerprint, expiresAt) ->
                fingerprint.length == 64 &&
                    fingerprint.all { it in '0'..'9' || it in 'a'..'f' } &&
                    expiresAt > nowEpochSecond
            }
            .associate { it.key to it.value }

        if ((validEntries[key] ?: Long.MIN_VALUE) > nowEpochSecond) {
            return Decision(accepted = false, entries = validEntries)
        }

        val bounded = (validEntries + (key to nowEpochSecond + RETENTION_SECONDS))
            .entries
            .sortedWith(compareByDescending<Map.Entry<String, Long>> { it.value }.thenBy { it.key })
            .take(MAX_ENTRIES)
            .fold(LinkedHashMap<String, Long>()) { accumulator, entry ->
                accumulator[entry.key] = entry.value
                accumulator
            }

        return Decision(accepted = true, entries = bounded)
    }
}
