package com.blaise.opentennis

/** Presentation-only state for the server-authoritative MEMORABLE_CONFIRMED event. */
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
    companion object {
        const val AUTHORITATIVE_EVENT = "MEMORABLE_CONFIRMED"
        const val OVERLAY_MS = 1200L
        const val OVATION_MS = 2200L
    }

    private val seenSequenceIds = mutableSetOf<String>()
    var state = MemorableUiState()
        private set

    /** Accepts only the authoritative event and deduplicates reconnect/resend by sequenceId. */
    fun onAuthoritativeConfirmed(
        eventType: String,
        sequenceId: String,
        player: MemorablePlayer,
        total: Int,
        localCount: Int,
        opponentCount: Int,
        nowMs: Long,
    ): Boolean {
        if (eventType != AUTHORITATIVE_EVENT || sequenceId.isBlank() || sequenceId in seenSequenceIds) return false
        require(total >= 1)
        require(localCount >= 0 && opponentCount >= 0)
        require(localCount + opponentCount == total)
        val scorerCount = if (player == MemorablePlayer.LOCAL) localCount else opponentCount
        require(scorerCount >= 1)
        seenSequenceIds += sequenceId
        state = state.copy(
            cameraBadgeTotal = total,
            localCount = localCount,
            opponentCount = opponentCount,
            lastPlayer = player,
            overlayStartedMs = nowMs,
            overlayUntilMs = nowMs + OVERLAY_MS,
            standingOvationStartedMs = nowMs,
            standingOvationUntilMs = nowMs + OVATION_MS,
            applauseCuePending = true,
            replayAvailable = false,
            replayPanelVisible = false,
            replayFilter = MemorableReplayFilter.ALL,
        )
        return true
    }

    /** Compatibility entry point for existing deterministic tests; production bridge uses sequenceId overload. */
    fun onAuthoritativeConfirmed(player: MemorablePlayer, total: Int, localCount: Int, opponentCount: Int, nowMs: Long) {
        onAuthoritativeConfirmed(AUTHORITATIVE_EVENT, "legacy-$total-$localCount-$opponentCount-$nowMs", player, total, localCount, opponentCount, nowMs)
    }

    fun consumeApplauseCue(): Boolean {
        if (!state.applauseCuePending) return false
        state = state.copy(applauseCuePending = false)
        return true
    }

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

    fun closeReplayPanel() { state = state.copy(replayPanelVisible = false) }

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

    /** Clears per-set presentation while keeping reconnect dedupe IDs for this match session. */
    fun resetForNewSet() { state = MemorableUiState() }
}
