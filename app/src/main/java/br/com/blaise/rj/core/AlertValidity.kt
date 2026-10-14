package br.com.blaise.rj.core

import java.time.Duration
import java.time.Instant

enum class AlertValidity { SCHEDULED, ACTIVE, REVIEW_DUE, UNVERIFIED, EXPIRED }

/** Validity comes from the issuer. Missing observations never cancel a warning. */
object AlertValidityPolicy {
    fun evaluate(
        issuedAt: Instant,
        onset: Instant,
        expiresAt: Instant,
        now: Instant,
        sourceCurrent: Boolean,
    ): AlertValidity {
        if (issuedAt.isAfter(now) || !expiresAt.isAfter(onset)) return AlertValidity.UNVERIFIED
        if (!expiresAt.isAfter(now)) return AlertValidity.EXPIRED
        if (!sourceCurrent) return AlertValidity.UNVERIFIED
        if (onset.isAfter(now)) return AlertValidity.SCHEDULED
        return if (Duration.between(onset, now).seconds >= 3600)
            AlertValidity.REVIEW_DUE else AlertValidity.ACTIVE
    }

    fun label(state: AlertValidity): String = when (state) {
        AlertValidity.SCHEDULED -> "Aviso emitido • início previsto adiante"
        AlertValidity.ACTIVE -> "Alerta oficial vigente"
        AlertValidity.REVIEW_DUE -> "Alerta oficial vigente • reavaliação necessária"
        AlertValidity.UNVERIFIED -> "Vigência sem confirmação atual • novas informações em breve"
        AlertValidity.EXPIRED -> "Alerta expirado • novas informações em breve"
    }
}
