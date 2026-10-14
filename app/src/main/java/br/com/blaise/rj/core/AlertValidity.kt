package br.com.blaise.rj.core

import java.time.Duration
import java.time.Instant

enum class AlertValidity { SCHEDULED, ACTIVE, REVIEW_DUE, UNVERIFIED, EXPIRED }
enum class AlertUpdateAge { CURRENT, NO_UPDATE_3H, NO_UPDATE_4H, INVALID }

/** Validity comes from the issuer. Missing observations never cancel a warning. */
object AlertValidityPolicy {
    const val HISTORY_SECONDS = 12L * 3600

    /** Downloading the same notice again does not renew its official emission. */
    fun updateAge(lastOfficialUpdate: Instant, now: Instant): AlertUpdateAge {
        val age = Duration.between(lastOfficialUpdate, now).seconds
        return when {
            lastOfficialUpdate.isAfter(now) -> AlertUpdateAge.INVALID
            age >= 4 * 3600 -> AlertUpdateAge.NO_UPDATE_4H
            age >= 3 * 3600 -> AlertUpdateAge.NO_UPDATE_3H
            else -> AlertUpdateAge.CURRENT
        }
    }

    fun updateLabel(age: AlertUpdateAge): String? = when (age) {
        AlertUpdateAge.CURRENT -> null
        AlertUpdateAge.NO_UPDATE_3H -> "Dados do aviso sem atualização há pelo menos 3 horas. Não confirma fim do risco."
        AlertUpdateAge.NO_UPDATE_4H -> "Ausência de dados novos há pelo menos 4 horas. Gravidade oficial preservada; risco atual sem confirmação."
        AlertUpdateAge.INVALID -> "Horário de atualização inválido; vigência sem confirmação."
    }

    fun retainHistory(expiresAt: Instant, now: Instant): Boolean =
        Duration.between(expiresAt, now).seconds < HISTORY_SECONDS

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
