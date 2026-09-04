package br.com.blaise.rj.core

import java.time.Duration
import java.time.Instant

data class OfficialFeedEvidence(
    val source: String,
    val checkedAt: Instant,
    val activeP0Count: Int,
    val maxAgeSeconds: Long = 90,
) {
    init {
        require(source.isNotBlank()) { "Official source must be identified" }
        require(activeP0Count >= 0) { "Active P0 count cannot be negative" }
        require(maxAgeSeconds > 0) { "Official evidence max age must be positive" }
    }
}

enum class OfficialFeedState {
    CURRENT_CLEAR,
    CURRENT_P0,
    STALE,
    UNAVAILABLE,
}

object OfficialFeedStatusPolicy {
    fun state(evidence: OfficialFeedEvidence?, now: Instant): OfficialFeedState {
        evidence ?: return OfficialFeedState.UNAVAILABLE
        if (evidence.checkedAt.isAfter(now.plusSeconds(5))) return OfficialFeedState.STALE

        val ageSeconds = Duration.between(evidence.checkedAt, now).seconds
        if (ageSeconds > evidence.maxAgeSeconds) return OfficialFeedState.STALE

        return if (evidence.activeP0Count > 0) {
            OfficialFeedState.CURRENT_P0
        } else {
            OfficialFeedState.CURRENT_CLEAR
        }
    }
}
