package br.com.blaise.rj.push

import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.core.OfficialAlert
import br.com.blaise.rj.core.RetentionPolicy
import br.com.blaise.rj.core.Severity
import java.time.Duration
import java.time.Instant

object P0PushParser {
    private const val SCHEMA_VERSION = "1"
    private const val EVENT_TYPE = "p0_official_alert"
    private const val AUTHORITY = "official"
    private const val MAX_ID_LENGTH = 256
    private const val MAX_TITLE_LENGTH = 180
    private const val MAX_SOURCE_LENGTH = 120
    private const val FUTURE_SKEW_SECONDS = 5L * 60L

    fun parse(data: Map<String, String>, now: Instant = Instant.now()): OfficialAlert? {
        if (data["schemaVersion"] != SCHEMA_VERSION) return null
        if (data["eventType"] != EVENT_TYPE) return null
        if (data["authority"] != AUTHORITY) return null
        if (data["severity"] != Severity.P0.name) return null

        val id = data["alertId"]?.trim().orEmpty()
        val title = data["title"]?.trim().orEmpty()
        val source = data["source"]?.trim().orEmpty()
        if (id.isEmpty() || id.length > MAX_ID_LENGTH) return null
        if (title.isEmpty() || title.length > MAX_TITLE_LENGTH) return null
        if (source.isEmpty() || source.length > MAX_SOURCE_LENGTH) return null

        val issuedAt = data["issuedAt"]?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return null
        val expiresAt = data["expiresAt"]?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return null
        if (issuedAt.isAfter(now.plusSeconds(FUTURE_SKEW_SECONDS))) return null
        if (!expiresAt.isAfter(now) || !expiresAt.isAfter(issuedAt)) return null

        val validitySeconds = Duration.between(issuedAt, expiresAt).seconds
        if (validitySeconds !in 1..RetentionPolicy.SEVERE_EVENT_MAX_SECONDS) return null

        val cityName = data["cityName"]?.trim().orEmpty()
        val cityIbge = data["cityIbge"]?.trim().orEmpty()
        val city = if (cityName.isEmpty() && cityIbge.isEmpty()) {
            null
        } else {
            if (cityName.isEmpty() || cityIbge.isEmpty()) return null
            val code = cityIbge.toIntOrNull() ?: return null
            RioMunicipalities.all.firstOrNull { it.ibgeCode == code && it.name == cityName } ?: return null
        }

        return OfficialAlert(
            id = id,
            city = city,
            title = title,
            source = source,
            severity = Severity.P0,
            issuedAt = issuedAt,
            expiresAt = expiresAt,
        )
    }
}
