package com.blaise.opentennis

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MemorableReplayCatalogTest {
    private fun replay(id: String, sequence: String, set: Int, player: MemorablePlayer) = MemorableReplay(
        eventId = id,
        sequenceId = sequence,
        setNumber = set,
        player = player,
        similarity = 0.95,
        deterministicReplayRef = "replay://$sequence",
    )

    @Test fun separatesSetAndPlayerFilters() {
        val c = MemorableReplayCatalog()
        c.register(replay("e1", "s1", 1, MemorablePlayer.LOCAL))
        c.register(replay("e2", "s2", 1, MemorablePlayer.OPPONENT))
        c.register(replay("e3", "s3", 2, MemorablePlayer.LOCAL))
        assertEquals(2, c.forSet(1).size)
        assertEquals(1, c.forSet(1, ReplayFilter.LOCAL).size)
        assertEquals(1, c.forSet(1, ReplayFilter.OPPONENT).size)
        assertEquals(1, c.forSet(2).size)
    }

    @Test fun duplicateEventOrSequenceIsIdempotent() {
        val c = MemorableReplayCatalog()
        assertTrue(c.register(replay("e1", "s1", 1, MemorablePlayer.LOCAL)))
        assertFalse(c.register(replay("e1", "s2", 1, MemorablePlayer.LOCAL)))
        assertFalse(c.register(replay("e2", "s1", 1, MemorablePlayer.OPPONENT)))
        assertEquals(1, c.total())
    }

    @Test fun unwatchedSurvivesSetTransitionAndCanBeMarkedWatched() {
        val c = MemorableReplayCatalog()
        c.register(replay("e1", "s1", 1, MemorablePlayer.LOCAL))
        c.register(replay("e2", "s2", 2, MemorablePlayer.OPPONENT))
        assertEquals(2, c.postMatchUnwatched().size)
        assertTrue(c.markWatched("e1"))
        assertEquals(listOf("e2"), c.postMatchUnwatched().map { it.eventId })
    }

    @Test(expected = IllegalArgumentException::class)
    fun belowThresholdCannotEnterCatalog() {
        MemorableReplayCatalog().register(
            MemorableReplay("e", "s", 1, MemorablePlayer.LOCAL, 0.9499, "replay://s")
        )
    }
}
