package com.blaise.opentennis

/** Lightweight per-participant connection health model for competitive matches. */
object MatchNetworkHealth {
    enum class Quality { GOOD, DEGRADED, BAD, DISCONNECTED }

    data class ParticipantHealth(
        val playerPublicId: String,
        val rttMs: Long,
        val packetLossPercent: Double,
        val millisSinceLastServerPacket: Long,
    )

    data class Notice(val quality: Quality, val text: String)

    fun classify(sample: ParticipantHealth): Quality = when {
        sample.millisSinceLastServerPacket >= 8_000L -> Quality.DISCONNECTED
        sample.rttMs >= 450L || sample.packetLossPercent >= 12.0 || sample.millisSinceLastServerPacket >= 3_000L -> Quality.BAD
        sample.rttMs >= 220L || sample.packetLossPercent >= 4.0 || sample.millisSinceLastServerPacket >= 1_500L -> Quality.DEGRADED
        else -> Quality.GOOD
    }

    fun noticeFor(sample: ParticipantHealth): Notice = when (val quality = classify(sample)) {
        Quality.GOOD -> Notice(quality, "Conexão estável")
        Quality.DEGRADED -> Notice(quality, "Sua internet está oscilando. A partida continua sincronizada pelo servidor.")
        Quality.BAD -> Notice(quality, "Problema de conexão detectado. Pode haver atraso temporário na partida.")
        Quality.DISCONNECTED -> Notice(quality, "Conexão interrompida. Tentando reconectar sem alterar o estado oficial da partida.")
    }

    /** Both peers can receive independent notices; one player's problem is not hidden from the other. */
    fun noticesForBoth(first: ParticipantHealth, second: ParticipantHealth): Map<String, Notice> =
        linkedMapOf(first.playerPublicId to noticeFor(first), second.playerPublicId to noticeFor(second))
}
