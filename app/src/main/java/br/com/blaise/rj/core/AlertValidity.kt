package br.com.blaise.rj.core

import java.time.Duration
import java.time.Instant

enum class AlertValidity { SCHEDULED, ACTIVE, REVIEW_DUE, UNVERIFIED, EXPIRED, LOCAL_EXPIRED }
enum class AlertUpdateAge { CURRENT, NO_UPDATE_3H, NO_UPDATE_4H, INVALID }

/** Caps local presentation lifetime without cancelling the original official notice. */
object AlertValidityPolicy {
    const val HISTORY_SECONDS = 12L * 3600
    const val MAX_WITHOUT_UPDATE_SECONDS = 12L * 3600

    fun activeUntil(issuedAt: Instant, expiresAt: Instant): Instant =
        minOf(expiresAt, issuedAt.plusSeconds(MAX_WITHOUT_UPDATE_SECONDS))

    fun retainHistory(issuedAt: Instant, expiresAt: Instant, now: Instant): Boolean =
        now.isBefore(activeUntil(issuedAt, expiresAt).plusSeconds(HISTORY_SECONDS))

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
        AlertUpdateAge.NO_UPDATE_3H -> "Sem atualização nas últimas 3 horas • risco atual sem confirmação."
        AlertUpdateAge.NO_UPDATE_4H -> "Sem atualização nas últimas 4 horas • risco atual sem confirmação."
        AlertUpdateAge.INVALID -> "Horário de atualização inválido; vigência sem confirmação."
    }

    fun evaluate(
        issuedAt: Instant,
        onset: Instant,
        expiresAt: Instant,
        now: Instant,
        sourceCurrent: Boolean,
    ): AlertValidity {
        if (issuedAt.isAfter(now) || !expiresAt.isAfter(onset)) return AlertValidity.UNVERIFIED
        if (!expiresAt.isAfter(now)) return AlertValidity.EXPIRED
        if (!activeUntil(issuedAt, expiresAt).isAfter(now)) return AlertValidity.LOCAL_EXPIRED
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
        AlertValidity.LOCAL_EXPIRED -> "Expirado no Blaise após 12 horas sem nova emissão • somente histórico"
    }
}
