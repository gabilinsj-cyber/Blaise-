package br.com.blaise.rj.core

import java.time.Instant

enum class SourceHealthState { HEALTHY, DEGRADED, STALE, UNAVAILABLE }

data class SourceObservation(
    val sourceId: String,
    val lastCheckedAt: Instant?,
    val lastSuccessAt: Instant?,
    val consecutiveFailures: Int,
)

object SourceHealthPolicy {
    fun state(observation: SourceObservation, now: Instant, maxAgeSeconds: Long): SourceHealthState {
        require(maxAgeSeconds > 0) { "maxAgeSeconds must be positive" }
        val successAt = observation.lastSuccessAt ?: return SourceHealthState.UNAVAILABLE
        val ageSeconds = now.epochSecond - successAt.epochSecond
        if (ageSeconds < 0 || ageSeconds > maxAgeSeconds) return SourceHealthState.STALE
        return if (observation.consecutiveFailures > 0) SourceHealthState.DEGRADED else SourceHealthState.HEALTHY
    }
}

class SourceHealthMonitor {
    private val observations = linkedMapOf<String, SourceObservation>()

    @Synchronized
    fun recordSuccess(sourceId: String, checkedAt: Instant) {
        require(sourceId.isNotBlank())
        observations[sourceId] = SourceObservation(sourceId, checkedAt, checkedAt, 0)
    }

    @Synchronized
    fun recordFailure(sourceId: String, checkedAt: Instant) {
        require(sourceId.isNotBlank())
        val previous = observations[sourceId]
        observations[sourceId] = SourceObservation(
            sourceId = sourceId,
            lastCheckedAt = checkedAt,
            lastSuccessAt = previous?.lastSuccessAt,
            consecutiveFailures = (previous?.consecutiveFailures ?: 0) + 1,
        )
    }

    @Synchronized
    fun snapshot(): List<SourceObservation> = observations.values.toList()
}
