package com.blaise.opentennis

/**
 * Boundary between the authenticated competitive transport and presentation.
 * Only server-originated envelopes accepted by the transport may enter here.
 * This class does not expose a client command that can create memorable credit.
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
    )

    enum class Origin { AUTHORITATIVE_SERVER, CLIENT }

    private val deliveredEventIds = LinkedHashSet<String>()
    private val deliveredSequenceIds = LinkedHashSet<String>()

    fun accept(envelope: ServerEnvelope): Boolean {
        if (envelope.origin != Origin.AUTHORITATIVE_SERVER) return false
        if (expectedMatchId.isBlank() || envelope.matchId != expectedMatchId) return false
        if (envelope.type != "MEMORABLE_CONFIRMED") return false
        if (envelope.eventId.isBlank() || envelope.sequenceId.isBlank()) return false
        if (envelope.similarity < 0.95 || envelope.similarity > 1.0) return false
        if (envelope.total < 1 || envelope.localCount < 0 || envelope.opponentCount < 0) return false
        if (envelope.localCount + envelope.opponentCount != envelope.total) return false
        val scorerCount = if (envelope.player == MemorablePlayer.LOCAL) envelope.localCount else envelope.opponentCount
        if (scorerCount < 1) return false
        if (envelope.eventId in deliveredEventIds || envelope.sequenceId in deliveredSequenceIds) return false

        // Reserve IDs before presentation so retransmissions cannot double-count.
        deliveredEventIds.add(envelope.eventId)
        deliveredSequenceIds.add(envelope.sequenceId)
        return try {
            view.onMemorableConfirmed(
                player = envelope.player,
                total = envelope.total,
                localCount = envelope.localCount,
                opponentCount = envelope.opponentCount,
            )
            true
        } catch (_: IllegalArgumentException) {
            deliveredEventIds.remove(envelope.eventId)
            deliveredSequenceIds.remove(envelope.sequenceId)
            false
        }
    }
}
