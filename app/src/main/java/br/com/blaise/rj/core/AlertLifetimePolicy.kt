package br.com.blaise.rj.core

import java.time.Duration
import java.time.Instant

object AlertLifetimePolicy {
    fun nextRecheckMillis(expiries: List<Instant>, now: Instant): Long = expiries
        .filter { it.isAfter(now) }
        .mapNotNull { runCatching { Duration.between(now, it).toMillis().coerceAtLeast(1) }.getOrNull() }
        .minOrNull()?.coerceAtMost(30_000) ?: 30_000

    fun remainingMillis(alert: OfficialAlert, now: Instant): Long? {
        if (alert.issuedAt.isAfter(now) || !alert.expiresAt.isAfter(now) ||
            !alert.expiresAt.isAfter(alert.issuedAt)) return null
        val until = AlertValidityPolicy.activeUntil(alert.issuedAt, alert.expiresAt)
        if (!until.isAfter(now)) return null
        return runCatching { Duration.between(now, until).toMillis().coerceAtLeast(1) }.getOrNull()
    }
}
