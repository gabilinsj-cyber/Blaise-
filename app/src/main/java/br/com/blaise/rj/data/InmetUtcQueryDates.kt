package br.com.blaise.rj.data

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * INMET's automatic-station time stamps and date-range endpoint use UTC.
 * Choosing the date in America/Sao_Paulo can omit the last station readings
 * from 21:00 to midnight Brasília time.
 *
 * Keep the identical UTC range for the live card and the historical chart.
 */
object InmetUtcQueryDates {
    fun range(now: Instant): Pair<LocalDate, LocalDate> {
        val utcDate = now.atZone(ZoneOffset.UTC).toLocalDate()
        return utcDate.minusDays(1) to utcDate
    }
}
