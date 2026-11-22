package br.com.blaise.rj

import br.com.blaise.rj.data.UsgsRecentEarthquakes
import br.com.blaise.rj.data.UsgsEarthquakeSnapshot
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class UsgsRecentEarthquakesPolicyTest {
    @Test fun sourceIsOfficialAndShowsThreeRecentLargestWithThirtyMinuteFreshness() {
        assertEquals(3, UsgsRecentEarthquakes.DISPLAY_COUNT)
        assertEquals(30L, UsgsRecentEarthquakes.REFRESH_MINUTES)
        assertTrue(UsgsRecentEarthquakes.FEED_URL.startsWith(
            "https://earthquake.usgs.gov/earthquakes/feed/v1.0/"))
        assertTrue(UsgsRecentEarthquakes.ALL_RECENT_URL.startsWith(
            "https://earthquake.usgs.gov/earthquakes/"))
        val now=Instant.parse("2026-11-22T13:00:00Z")
        val valid=UsgsEarthquakeSnapshot(now.minusSeconds(5),now.minusSeconds(5),emptyList())
        assertTrue(valid.current(now))
        assertFalse(valid.copy(generatedAt=now.minusSeconds(1801)).current(now))
        assertFalse(valid.copy(checkedAt=now.minusSeconds(1801)).current(now))
        assertFalse(valid.copy(checkedAt=now.plusSeconds(1)).current(now))
    }
}
