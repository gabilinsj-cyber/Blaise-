package br.com.blaise.rj.data

import android.content.Context
import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.core.AlertValidityPolicy
import java.time.Instant
import org.json.JSONArray
import org.json.JSONObject

/** Locally retained provenance, never evidence of a current source connection. */
class OfficialWarningHistory(context: Context) {
    private val preferences = context.getSharedPreferences("rj_official_warning_history_v1", Context.MODE_PRIVATE)

    fun read(now: Instant): List<PublicRjWarning> = runCatching {
        val encoded = preferences.getString("warnings", null) ?: return emptyList()
        require(encoded.length <= 80 * 1024)
        val rows = JSONArray(encoded)
        require(rows.length() <= 64)
        val retained = (0 until rows.length()).mapNotNull { index -> runCatching {
            val row = rows.getJSONObject(index)
            val codes = row.getJSONArray("municipalities")
            require(codes.length() in 1..92)
            val municipalities = (0 until codes.length()).map(codes::getInt)
            require(municipalities.all { RioMunicipalities.byIbgeCode(it) != null })
            val warning = PublicRjWarning(row.getString("id"), row.getString("event"),
                row.getString("severity"), Instant.parse(row.getString("sent")),
                Instant.parse(row.getString("onset")), Instant.parse(row.getString("expires")),
                municipalities, row.getString("sourceUrl"),
                if (row.isNull("closedAt")) null else Instant.parse(row.getString("closedAt")))
            require(valid(warning, now))
            warning.takeIf { it.retainHistory(now) }
        }.getOrNull() }
        if (retained.size != rows.length()) write(retained)
        retained
    }.getOrElse { preferences.edit().remove("warnings").apply(); emptyList() }

    fun merge(previous: List<PublicRjWarning>, incoming: List<PublicRjWarning>, now: Instant,
        inventory: PublicWarningInventory? = null): List<PublicRjWarning> {
        val fresh = incoming.filter { it.current(now) && !previous.any { old -> old.id == it.id && old.sent > it.sent } }
        return (previous + fresh).distinctBy { "${it.id}|${it.sent}" }
            .map { w -> if (w.localClosedAt == null && inventory?.sourceId == "inmet" &&
                inventory.withdrawn(w.id, w.sent, now)) w.copy(localClosedAt = minOf(inventory.checkedAt, w.localActiveUntil())) else w }
            .filter { valid(it, now) && it.retainHistory(now) }
            .sortedByDescending { it.sent }.take(64)
    }

    fun write(warnings: List<PublicRjWarning>) {
        val rows = JSONArray()
        warnings.take(64).forEach { w -> rows.put(JSONObject()
            .put("id", w.id).put("event", w.event).put("severity", w.severity)
            .put("sent", w.sent.toString()).put("onset", w.onset.toString())
            .put("expires", w.expires.toString()).put("sourceUrl", w.sourceUrl)
            .put("closedAt", w.localClosedAt?.toString() ?: JSONObject.NULL)
            .put("municipalities", JSONArray(w.municipalityIbges))) }
        val encoded = rows.toString()
        if (encoded.length <= 80 * 1024) preferences.edit().putString("warnings", encoded).apply()
    }

    private fun valid(w: PublicRjWarning, now: Instant) =
        w.id.length in 1..256 && w.event.length in 1..512 && w.severity.length in 1..64 &&
        w.sourceUrl in setOf("https://apiprevmet3.inmet.gov.br/avisos/rss", "https://wis2bra.inmet.gov.br/data/") &&
        (w.localClosedAt == null || !w.localClosedAt.isBefore(w.sent) && !w.localClosedAt.isAfter(now)) &&
        !w.sent.isAfter(now) && w.expires.isAfter(w.onset) && w.expires.isAfter(w.sent) &&
        w.municipalityIbges.isNotEmpty() && w.municipalityIbges.size <= 92 &&
        w.municipalityIbges.all { RioMunicipalities.byIbgeCode(it) != null }
}
