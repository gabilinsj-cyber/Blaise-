package com.blaise.opentennis

import org.junit.Assert.*
import org.junit.Test

class MatchNetworkHealthTest {
    @Test fun classifiesHealthyAndDegradedLinks() {
        assertEquals(
            MatchNetworkHealth.Quality.GOOD,
            MatchNetworkHealth.classify(MatchNetworkHealth.ParticipantHealth("R1", 80, 0.5, 200)),
        )
        assertEquals(
            MatchNetworkHealth.Quality.DEGRADED,
            MatchNetworkHealth.classify(MatchNetworkHealth.ParticipantHealth("R1", 250, 1.0, 200)),
        )
        assertEquals(
            MatchNetworkHealth.Quality.BAD,
            MatchNetworkHealth.classify(MatchNetworkHealth.ParticipantHealth("R1", 500, 1.0, 200)),
        )
        assertEquals(
            MatchNetworkHealth.Quality.DISCONNECTED,
            MatchNetworkHealth.classify(MatchNetworkHealth.ParticipantHealth("R1", 80, 0.0, 8_000)),
        )
    }

    @Test fun bothParticipantsReceiveIndependentStatus() {
        val notices = MatchNetworkHealth.noticesForBoth(
            MatchNetworkHealth.ParticipantHealth("R1", 80, 0.0, 200),
            MatchNetworkHealth.ParticipantHealth("R2", 500, 15.0, 3_500),
        )
        assertEquals(2, notices.size)
        assertEquals(MatchNetworkHealth.Quality.GOOD, notices.getValue("R1").quality)
        assertEquals(MatchNetworkHealth.Quality.BAD, notices.getValue("R2").quality)
    }
}
