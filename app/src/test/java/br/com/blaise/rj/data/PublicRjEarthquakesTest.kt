package br.com.blaise.rj.data

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PublicRjEarthquakesTest {
    private val now = Instant.parse("2026-10-12T03:00:00Z")
    private val quake = RjEarthquakeEvent(
        "usabc123",4.6,"Perto do Atlântico Sul",
        now.minusSeconds(900),12.0,
        "https://earthquake.usgs.gov/earthquakes/eventpage/usabc123",
        "REVIEWED",
    )
    @Test fun validGlobalEarthquakesRemainInformationalOnly() {
        assertTrue(quake.valid(now))
        assertFalse(quake.copy(sourceUrl="https://untrusted.example.org/earthquake").valid(now))
        assertFalse(quake.copy(magnitude=Double.NaN).valid(now))
        assertFalse(quake.copy(magnitude=-5.0).valid(now))
        assertFalse(quake.copy(occurredAt=now.minusSeconds(28*3600)).valid(now))
    }
    @Test fun recentBackendAndUsgsFeedMustBothBeCurrent() {
        val snapshot=RjEarthquakeSnapshot(now.minusSeconds(30),
            now.minusSeconds(300),listOf(quake))
        assertTrue(snapshot.current(now))
        assertFalse(snapshot.current(now.plusSeconds(121)))
        assertFalse(snapshot.copy(observedFeedGeneratedAt=now.minusSeconds(5000)).current(now))
        assertFalse(snapshot.copy(events=listOf(quake,quake,quake)).current(now))
    }
    @Test fun seismicEndpointIsConfiguredOnlyWithHttpsOrigin() {
        assertNull(PublicRjEarthquakeClient.create(""))
        assertNull(PublicRjEarthquakeClient.create("http://weather.example.org"))
        assertNull(PublicRjEarthquakeClient.create("https://weather.example.org/path"))
        assertNull(PublicRjEarthquakeClient.create("https://user:password@weather.example.org"))
        assertTrue(PublicRjEarthquakeClient.create("https://weather.example.org")!=null)
        assertEquals("/v1/public/rj-earthquakes", RJ_EARTHQUAKES_PATH)
    }
}
