package br.com.blaise.rj.data

import java.time.Instant
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test

class InmetUtcQueryDatesTest {
    @Test fun dayRangeIsAlwaysOfficialUtcNotBrasiliaLocalDate() {
        val (start, end) = InmetUtcQueryDates.range(
            Instant.parse("2026-10-14T02:30:00Z")
        )
        assertEquals(LocalDate.parse("2026-10-13"), start)
        assertEquals(LocalDate.parse("2026-10-14"), end)
        // In Brasília this is still 13 October at 23:30;
        // querying 12–13 would miss the just-published UTC day.
    }

    @Test fun exactUtcMidnightCrossesToNewInmetDay() {
        val before = InmetUtcQueryDates.range(
            Instant.parse("2026-10-13T23:59:59Z")
        )
        val after = InmetUtcQueryDates.range(
            Instant.parse("2026-10-14T00:00:00Z")
        )
        assertEquals(LocalDate.parse("2026-10-13"), before.second)
        assertEquals(LocalDate.parse("2026-10-14"), after.second)
        assertEquals(LocalDate.parse("2026-10-13"), after.first)
    }

    @Test fun localStationSeriesAndCurrentCardShareExactUtcDayContract() {
        for (instant in listOf(
            "2026-01-01T00:00:00Z",
            "2026-04-30T23:59:59Z",
            "2026-10-13T18:00:00Z",
            "2026-12-31T23:59:59Z",
        )) {
            val time = Instant.parse(instant)
            val (start, end) = InmetUtcQueryDates.range(time)
            assertEquals(end.minusDays(1), start)
            assertEquals(time.toString().substring(0, 10), end.toString())
        }
    }
}
