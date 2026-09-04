package br.com.blaise.rj.core

import java.time.Duration
import java.time.Instant

data class OfficialSourceSnapshot(
    val source: String,
    val checkedAt: Instant,
    val alerts: List<OfficialAlert>,
    val operational: Boolean,
    val coverageComplete: Boolean,
    val maxAgeSeconds: Long = 90,
) {
    init {
        require(source.isNotBlank()) { "Official source must be identified" }
        require(maxAgeSeconds > 0) { "Official source max age must be positive" }
    }
}

object OfficialAlertReconciliationPolicy {
    fun reconcile(
        requiredSources: Set<String>,
        snapshots: List<OfficialSourceSnapshot>,
        now: Instant,
    ): OfficialFeedEvidence? {
        val current = snapshots.filter { it.isCurrent(now) }
        val activeP0 = current.flatMap { snapshot ->
            snapshot.alerts.filter { alert ->
                alert.severity == Severity.P0 &&
                    !alert.issuedAt.isAfter(now) &&
                    alert.expiresAt.isAfter(now)
            }.map { snapshot to it }
        }

        if (activeP0.isNotEmpty()) {
            val sources = activeP0.map { it.first }.distinctBy { it.source }
            return evidence(sources, activeP0.map { it.second.id }.distinct().size, now)
        }

        val required = requiredSources.map(String::trim).filter(String::isNotEmpty).toSet()
        if (required.isEmpty()) return null

        val completeBySource = current
            .filter { it.coverageComplete }
            .groupBy { it.source }
            .mapValues { (_, values) -> values.maxBy { it.checkedAt } }

        if (!required.all(completeBySource::containsKey)) return null

        return evidence(required.mapNotNull(completeBySource::get), activeP0Count = 0, now = now)
    }

    private fun OfficialSourceSnapshot.isCurrent(now: Instant): Boolean {
        if (!operational) return false
        if (checkedAt.isAfter(now.plusSeconds(5))) return false
        val ageSeconds = Duration.between(checkedAt, now).seconds
        return ageSeconds <= maxAgeSeconds
    }

    private fun evidence(
        snapshots: List<OfficialSourceSnapshot>,
        activeP0Count: Int,
        now: Instant,
    ): OfficialFeedEvidence {
        val remainingSeconds = snapshots.minOf { snapshot ->
            val ageSeconds = Duration.between(snapshot.checkedAt, now).seconds.coerceAtLeast(0)
            (snapshot.maxAgeSeconds - ageSeconds).coerceAtLeast(1)
        }
        return OfficialFeedEvidence(
            source = snapshots.map { it.source }.distinct().sorted().joinToString(" + "),
            checkedAt = now,
            activeP0Count = activeP0Count,
            maxAgeSeconds = remainingSeconds,
        )
    }
}
