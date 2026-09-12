package com.blaise.opentennis

/**
 * Presentation-only state for an authoritative MEMORABLE_CONFIRMED event.
 * This layer never decides whether a rally is memorable and never changes scoring.
 */
enum class MemorableReplayFilter { ALL, LOCAL, OPPONENT }

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
    val replayAvailable: Boolean = false,
    val replayPanelVisible: Boolean = false,
    val replayFilter: MemorableReplayFilter = MemorableReplayFilter.ALL,
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

        state = state.copy(
            cameraBadgeTotal = total,
            localCount = localCount,
            opponentCount = opponentCount,
            lastPlayer = player,
            overlayStartedMs = nowMs,
            overlayUntilMs = nowMs + 1200L,
            standingOvationStartedMs = nowMs,
            standingOvationUntilMs = nowMs + 2200L,
            applauseCuePending = true,
            // Replays deliberately stay locked while the set is live.
            replayAvailable = false,
            replayPanelVisible = false,
            replayFilter = MemorableReplayFilter.ALL,
        )
    }

    fun consumeApplauseCue(): Boolean {
        if (!state.applauseCuePending) return false
        state = state.copy(applauseCuePending = false)
        return true
    }

    /**
     * Called only after the set has ended. This is the first moment in which the
     * camera/replay surface may expose memorable clips to the players.
     */
    fun onSetBreakStarted() {
        val available = state.cameraBadgeTotal > 0
        state = state.copy(
            replayAvailable = available,
            replayPanelVisible = available,
            replayFilter = MemorableReplayFilter.ALL,
            overlayStartedMs = 0L,
            overlayUntilMs = 0L,
            standingOvationStartedMs = 0L,
            standingOvationUntilMs = 0L,
            applauseCuePending = false,
        )
    }

    fun openReplayPanel(): Boolean {
        if (!state.replayAvailable) return false
        state = state.copy(replayPanelVisible = true)
        return true
    }

    fun closeReplayPanel() {
        state = state.copy(replayPanelVisible = false)
    }

    fun selectReplayFilter(filter: MemorableReplayFilter): Boolean {
        if (!state.replayAvailable) return false
        val hasItems = when (filter) {
            MemorableReplayFilter.ALL -> state.cameraBadgeTotal > 0
            MemorableReplayFilter.LOCAL -> state.localCount > 0
            MemorableReplayFilter.OPPONENT -> state.opponentCount > 0
        }
        if (!hasItems) return false
        state = state.copy(replayFilter = filter, replayPanelVisible = true)
        return true
    }

    /**
     * Start of a new set clears only the per-set presentation counters. Durable
     * post-match replay retention remains a server/replay-store responsibility.
     */
    fun resetForNewSet() {
        state = MemorableUiState()
    }
}
