package br.com.blaise.rj.push

import android.content.Context
import java.time.Instant

/**
 * Process-local synchronized persistence for P0 replay suppression.
 * Uses a dedicated SharedPreferences file and stores only hashed IDs + expiry.
 */
class P0ReplayStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun accept(alertId: String, now: Instant): Boolean = synchronized(lock) {
        val existing = preferences.all.mapNotNull { (key, value) ->
            (value as? Long)?.let { key to it }
        }.toMap()
        val decision = P0ReplayPolicy.evaluate(existing, alertId, now)
        if (!decision.accepted) return@synchronized false

        val editor = preferences.edit().clear()
        decision.entries.forEach { (key, expiresAt) -> editor.putLong(key, expiresAt) }
        check(editor.commit()) { "p0_replay_commit_failed" }
        true
    }

    private companion object {
        const val PREFS_NAME = "blaise_p0_replay_v1"
        val lock = Any()
    }
}
