package com.blaise.opentennis

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MemorablePresentationControllerTest {
    @Test
    fun authoritativeConfirmationUpdatesBadgeCountsAndShortOverlay() {
        val controller = MemorablePresentationController()
        controller.onAuthoritativeConfirmed(
            player = MemorablePlayer.LOCAL,
            total = 4,
            localCount = 3,
            opponentCount = 1,
            nowMs = 10_000L,
        )

        assertEquals(4, controller.state.cameraBadgeTotal)
        assertEquals(3, controller.state.localCount)
        assertEquals(1, controller.state.opponentCount)
        assertEquals(MemorablePlayer.LOCAL, controller.state.lastPlayer)
        assertEquals(10_000L, controller.state.overlayStartedMs)
        assertEquals(11_200L, controller.state.overlayUntilMs)
        assertEquals(10_000L, controller.state.standingOvationStartedMs)
        assertEquals(12_200L, controller.state.standingOvationUntilMs)
        assertFalse(controller.state.replayAvailable)
        assertFalse(controller.state.replayPanelVisible)
        assertFalse(controller.openReplayPanel())
        assertTrue(controller.consumeApplauseCue())
        assertFalse(controller.consumeApplauseCue())
    }

    @Test(expected = IllegalArgumentException::class)
    fun inconsistentPerPlayerCountsFailClosed() {
        MemorablePresentationController().onAuthoritativeConfirmed(
            player = MemorablePlayer.OPPONENT,
            total = 4,
            localCount = 2,
            opponentCount = 1,
            nowMs = 0L,
        )
    }

    @Test
    fun opponentConfirmationPreservesScorerForPresentationPlacement() {
        val controller = MemorablePresentationController()
        controller.onAuthoritativeConfirmed(MemorablePlayer.OPPONENT, 2, 1, 1, 500L)
        assertEquals(MemorablePlayer.OPPONENT, controller.state.lastPlayer)
        assertEquals(2, controller.state.cameraBadgeTotal)
    }

    @Test
    fun setBreakUnlocksReplayAndShowsPerPlayerCounts() {
        val controller = MemorablePresentationController()
        controller.onAuthoritativeConfirmed(MemorablePlayer.LOCAL, 4, 3, 1, 10_000L)

        controller.onSetBreakStarted()

        assertTrue(controller.state.replayAvailable)
        assertTrue(controller.state.replayPanelVisible)
        assertEquals(4, controller.state.cameraBadgeTotal)
        assertEquals(3, controller.state.localCount)
        assertEquals(1, controller.state.opponentCount)
        assertEquals(MemorableReplayFilter.ALL, controller.state.replayFilter)
        assertEquals(0L, controller.state.overlayUntilMs)
        assertEquals(0L, controller.state.standingOvationUntilMs)
    }

    @Test
    fun replayFiltersAreOnlySelectableWhenClipsExist() {
        val controller = MemorablePresentationController()
        controller.onAuthoritativeConfirmed(MemorablePlayer.LOCAL, 2, 2, 0, 0L)
        controller.onSetBreakStarted()

        assertTrue(controller.selectReplayFilter(MemorableReplayFilter.LOCAL))
        assertEquals(MemorableReplayFilter.LOCAL, controller.state.replayFilter)
        assertFalse(controller.selectReplayFilter(MemorableReplayFilter.OPPONENT))
        assertEquals(MemorableReplayFilter.LOCAL, controller.state.replayFilter)
        controller.closeReplayPanel()
        assertFalse(controller.state.replayPanelVisible)
        assertTrue(controller.openReplayPanel())
        assertTrue(controller.state.replayPanelVisible)
    }

    @Test
    fun emptySetDoesNotUnlockReplay() {
        val controller = MemorablePresentationController()
        controller.onSetBreakStarted()
        assertFalse(controller.state.replayAvailable)
        assertFalse(controller.state.replayPanelVisible)
        assertFalse(controller.openReplayPanel())
    }

    @Test
    fun resetForNewSetClearsAllPresentationCounters() {
        val controller = MemorablePresentationController()
        controller.onAuthoritativeConfirmed(MemorablePlayer.OPPONENT, 1, 0, 1, 0L)
        controller.onSetBreakStarted()
        controller.resetForNewSet()
        assertEquals(MemorableUiState(), controller.state)
    }
}
