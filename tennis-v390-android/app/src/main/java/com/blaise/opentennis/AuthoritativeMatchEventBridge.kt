package com.blaise.opentennis

/**
 * Boundary between authenticated competitive transport and presentation.
 * Telemetry is diagnostic only and never authorizes punishment by itself.
 */
class AuthoritativeMatchEventBridge(
    private val expectedMatchId: String,
    private val view: TennisGameView,
) {
    data class ServerEnvelope(
        val origin: Origin,
        val matchId: String,
        val type: String,
        val eventId: String,
        val sequenceId: String,
        val similarity: Double,
        val player: MemorablePlayer,
        val total: Int,
        val localCount: Int,
        val opponentCount: Int,
        val localTick: Long? = null,
        val authoritativeTick: Long? = null,
        val rttMs: Long? = null,
        val serverError: Boolean = false,
    )

    enum class Origin { AUTHORITATIVE_SERVER, CLIENT }

    private val deliveredEventIds = LinkedHashSet<String>()
    private val deliveredSequenceIds = LinkedHashSet<String>()

    fun accept(envelope: ServerEnvelope): Boolean {
        if (envelope.origin != Origin.AUTHORITATIVE_SERVER) {
            view.recordRiskSignal(strong = false)
            return false
        }
        if (expectedMatchId.isBlank() || envelope.matchId != expectedMatchId) {
            view.recordRiskSignal(strong = false)
            return false
        }
        envelope.rttMs?.let { view.recordNetworkSample(it, envelope.serverError) }
        if (envelope.serverError && envelope.rttMs == null) view.recordNetworkSample(-1L, true)
        if (envelope.localTick != null && envelope.authoritativeTick != null) {
            view.recordAuthoritativeTick(envelope.localTick, envelope.authoritativeTick)
        }
        if (envelope.type != "MEMORABLE_CONFIRMED") return false
        if (envelope.eventId.isBlank() || envelope.sequenceId.isBlank()) return false
        if (envelope.similarity < 0.95 || envelope.similarity > 1.0) return false
        if (envelope.total < 1 || envelope.localCount < 0 || envelope.opponentCount < 0) return false
        if (envelope.localCount + envelope.opponentCount != envelope.total) return false
        val scorerCount = if (envelope.player == MemorablePlayer.LOCAL) envelope.localCount else envelope.opponentCount
        if (scorerCount < 1) return false
        if (envelope.eventId in deliveredEventIds || envelope.sequenceId in deliveredSequenceIds) return false

        deliveredEventIds.add(envelope.eventId)
        deliveredSequenceIds.add(envelope.sequenceId)
        return try {
            view.onMemorableConfirmed(envelope.player, envelope.total, envelope.localCount, envelope.opponentCount)
            true
        } catch (_: IllegalArgumentException) {
            deliveredEventIds.remove(envelope.eventId)
            deliveredSequenceIds.remove(envelope.sequenceId)
            false
        }
    }
}
