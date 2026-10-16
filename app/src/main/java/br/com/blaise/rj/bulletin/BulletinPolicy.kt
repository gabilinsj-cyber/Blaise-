package br.com.blaise.rj.bulletin

import java.time.ZonedDateTime
import java.time.ZoneId

object BulletinPolicy {
    val hours = listOf(6, 12, 16)
    fun currentPeriod(now: ZonedDateTime): ZonedDateTime {
        val local = now.withZoneSameInstant(ZoneId.of("America/Sao_Paulo"))
        val hour = hours.lastOrNull { it <= local.hour }
        return if (hour == null) local.minusDays(1).withHour(16).withMinute(0).withSecond(0).withNano(0)
        else local.withHour(hour).withMinute(0).withSecond(0).withNano(0)
    }
    fun spoken(severity: Int, extraordinary: Boolean) = severity == 5 || extraordinary
    fun refreshSeconds(severity: Int) = if (severity >= 4) 30L else 300L
}
