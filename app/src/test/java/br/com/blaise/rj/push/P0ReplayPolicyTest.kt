package br.com.blaise.rj.push

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class P0ReplayPolicyTest {
    private val now = Instant.parse("2026-09-10T03:00:00Z")

    @Test
    fun firstDeliveryIsAcceptedAndDuplicateIsSuppressedWithin24Hours() {
        val first = P0ReplayPolicy.evaluate(emptyMap(), "official-alert-1", now)
        assertTrue(first.accepted)
        assertEquals(1, first.entries.size)

        val duplicate = P0ReplayPolicy.evaluate(
            first.entries,
            "official-alert-1",
            now.plusSeconds(60),
        )
        assertFalse(duplicate.accepted)
        assertEquals(first.entries, duplicate.entries)
    }

    @Test
    fun alertBecomesEligibleAgainAfterReplayWindowExpires() {
        val first = P0ReplayPolicy.evaluate(emptyMap(), "official-alert-2", now)
        val afterWindow = P0ReplayPolicy.evaluate(
            first.entries,
            "official-alert-2",
            now.plusSeconds(P0ReplayPolicy.RETENTION_SECONDS),
        )
        assertTrue(afterWindow.accepted)
    }

    @Test
    fun rawAlertIdIsNotRetainedAsReplayKey() {
        val alertId = "inmet:raw-official-identifier"
        val decision = P0ReplayPolicy.evaluate(emptyMap(), alertId, now)
        val key = decision.entries.keys.single()
        assertNotEquals(alertId, key)
        assertEquals(64, key.length)
        assertTrue(key.all { it in '0'..'9' || it in 'a'..'f' })
    }

    @Test
    fun malformedExpiredAndExcessEntriesArePrunedAndBounded() {
        val existing = buildMap {
            put("not-a-sha", now.plusSeconds(600).epochSecond)
            put("0".repeat(64), now.minusSeconds(1).epochSecond)
            repeat(P0ReplayPolicy.MAX_ENTRIES + 20) { index ->
                put(index.toString(16).padStart(64, 'a').takeLast(64), now.plusSeconds((index + 1).toLong()).epochSecond)
            }
        }
        val decision = P0ReplayPolicy.evaluate(existing, "official-alert-new", now)
        assertTrue(decision.accepted)
        assertTrue(decision.entries.size <= P0ReplayPolicy.MAX_ENTRIES)
        assertFalse(decision.entries.containsKey("not-a-sha"))
        assertFalse(decision.entries.containsKey("0".repeat(64)))
    }
}
