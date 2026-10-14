package br.com.blaise.rj.data

import android.content.Context
import br.com.blaise.rj.core.AlertValidityPolicy
import java.time.Instant
import org.json.JSONArray
import org.json.JSONObject

/** Regional CHM history never supplies a municipal risk classification. */
class OfficialMarineWarningHistory(context: Context) {
    private val preferences = context.getSharedPreferences("rj_marine_warning_history_v1", Context.MODE_PRIVATE)

    fun read(now: Instant): List<PublicRjMarineWarning> = runCatching {
        val encoded = preferences.getString("warnings", null) ?: return emptyList()
        require(encoded.length <= 32 * 1024)
        val rows = JSONArray(encoded)
        require(rows.length() <= 64)
        val retained = (0 until rows.length()).mapNotNull { index -> runCatching {
            val row = rows.getJSONObject(index)
            val areas = row.getJSONArray("areas")
            require(areas.length() in 1..8)
            val warning = PublicRjMarineWarning(row.getString("id"), row.getString("type"),
                Instant.parse(row.getString("issued")), Instant.parse(row.getString("until")),
                (0 until areas.length()).map(areas::getString),
                if (row.isNull("waveMin")) null else row.getDouble("waveMin"),
                if (row.isNull("waveMax")) null else row.getDouble("waveMax"),
                if (row.isNull("direction")) null else row.getString("direction"),
                row.getBoolean("ressaca"), if (row.isNull("closedAt")) null else Instant.parse(row.getString("closedAt")))
            require(valid(warning, now))
            warning.takeIf { it.retainHistory(now) }
        }.getOrNull() }
        if (retained.size != rows.length()) write(retained)
        retained
    }.getOrElse { preferences.edit().remove("warnings").apply(); emptyList() }

    fun merge(previous: List<PublicRjMarineWarning>, incoming: List<PublicRjMarineWarning>, now: Instant,
        inventory: PublicWarningInventory? = null): List<PublicRjMarineWarning> {
        val fresh = incoming.filter { it.current(now) && !previous.any { old -> old.id == it.id && old.issuedAt > it.issuedAt } }
        return (previous + fresh).distinctBy { "${it.id}|${it.issuedAt}" }
            .map { w -> if (w.localClosedAt == null && inventory?.sourceId == "chm" &&
                inventory.withdrawn(w.id, w.issuedAt, now)) w.copy(localClosedAt = minOf(inventory.checkedAt, w.localActiveUntil())) else w }
            .filter { valid(it, now) && it.retainHistory(now) }
            .sortedByDescending { it.issuedAt }.take(64)
    }

    fun write(warnings: List<PublicRjMarineWarning>) {
        val rows = JSONArray()
        for (w in warnings.take(64)) {
            rows.put(JSONObject().put("id", w.id).put("type", w.warningType)
                .put("issued", w.issuedAt.toString()).put("until", w.validUntil.toString())
                .put("closedAt", w.localClosedAt?.toString() ?: JSONObject.NULL)
                .put("areas", JSONArray(w.areas)).put("waveMin", w.waveMinMeters ?: JSONObject.NULL)
                .put("waveMax", w.waveMaxMeters ?: JSONObject.NULL)
                .put("direction", w.waveDirection ?: JSONObject.NULL).put("ressaca", w.officialRessacaLabel))
            if (rows.toString().length > 32 * 1024) { rows.remove(rows.length() - 1); break }
        }
        preferences.edit().putString("warnings", rows.toString()).apply()
    }

    private fun valid(w: PublicRjMarineWarning, now: Instant): Boolean =
        !w.issuedAt.isAfter(now) && w.warningType.length in 3..96 &&
        w.areas.size in 1..8 && w.areas.all { it.length in 1..48 } &&
        (w.localClosedAt == null || !w.localClosedAt.isBefore(w.issuedAt) && !w.localClosedAt.isAfter(now)) &&
        w.copy(localClosedAt = null).current(w.issuedAt) && ((w.waveMinMeters == null) == (w.waveDirection == null)) && (w.waveDirection == null || w.waveDirection.matches(Regex("^[NSEW/]{1,7}$")))
}
