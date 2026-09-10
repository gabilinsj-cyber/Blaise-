package com.blaise.opentennis

/**
 * Presentation-only state for an authoritative MEMORABLE_CONFIRMED event.
 * This layer never decides whether a rally is memorable and never changes scoring.
 */
data class MemorableUiState(
    val cameraBadgeTotal: Int = 0,
    val localCount: Int = 0,
    val opponentCount: Int = 0,
    val lastPlayer: MemorablePlayer? = null,
    val overlayStartedMs: Long = 0L,
    val overlayUntilMs: Long = 0L,
    val standingOvationStartedMs: Long = 0L,
    val standingOvationUntilMs: Long = 0L,
    val applauseCuePending: Boolean = false,
)

class MemorablePresentationController {
    var state = MemorableUiState()
        private set

    fun onAuthoritativeConfirmed(
        player: MemorablePlayer,
        total: Int,
        localCount: Int,
        opponentCount: Int,
        nowMs: Long,
    ) {
        require(total >= 1)
        require(localCount >= 0 && opponentCount >= 0)
        require(localCount + opponentCount == total)
        val scorerCount = if (player == MemorablePlayer.LOCAL) localCount else opponentCount
        require(scorerCount >= 1)

        state = MemorableUiState(
            cameraBadgeTotal = total,
            localCount = localCount,
            opponentCount = opponentCount,
            lastPlayer = player,
            overlayStartedMs = nowMs,
            overlayUntilMs = nowMs + 1200L,
            standingOvationStartedMs = nowMs,
            standingOvationUntilMs = nowMs + 2200L,
            applauseCuePending = true,
        )
    }

    fun consumeApplauseCue(): Boolean {
        if (!state.applauseCuePending) return false
        state = state.copy(applauseCuePending = false)
        return true
    }

    fun resetForNewSet() {
        state = MemorableUiState()
    }
}
