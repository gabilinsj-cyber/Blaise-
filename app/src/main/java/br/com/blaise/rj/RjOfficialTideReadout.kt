package br.com.blaise.rj

import br.com.blaise.rj.data.ChmTideDelivery
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Official CHM tide *predictions*, never measured sea level or live waves. */
data class RjOfficialTideReadout(
    val status: String,
    val station: String?,
    val nextHigh: String,
    val nextLow: String,
    val basis: String,
    val verifiedAt: Instant?,
    val hasCurrentOfficialPredictions: Boolean,
)

object RjOfficialTidePolicy {
    const val RIO_PORT_STATION = 40
    const val RIO_PORT_NAME = "PORTO DO RIO DE JANEIRO - I FISCAL"
    // Station numbers from the pinned official RJ CHM catalogue test. The
    // backend still validates station, year, signed source digest and delivery.
    val rjStations = linkedMapOf(
        38 to "Porto do Açu",
        39 to "Terminal de Imbetiba",
        40 to "Porto do Rio de Janeiro",
        41 to "Porto de Itaguaí",
        42 to "Porto do Forno",
        43 to "Terminal da Ilha Guaíba",
        44 to "Porto de Angra dos Reis",
    )
    private val tz = ZoneId.of("America/Sao_Paulo")
    private val fmt = DateTimeFormatter.ofPattern("dd/MM HH:mm")
    private const val MAX_AGE = 86_400L

    fun read(delivery: ChmTideDelivery?, now: Instant,
        expectedStationNumber: Int = RIO_PORT_STATION): RjOfficialTideReadout {
        val absent = RjOfficialTideReadout("SEM_ENTREGA_CHM_VIGENTE",null,"—","—",
            "Tábua de maré oficial: previsão; não é sensor em tempo real",null,false)
        if (delivery == null || delivery.state !in setOf("CURRENT","CURRENT_DEGRADED")
            || delivery.stationNumber != expectedStationNumber
            || delivery.snapshot.station.stationNumber != expectedStationNumber
            || delivery.calendarYear != now.atZone(tz).year
            || delivery.verificationAgeMs !in 0..86_400_000L) return absent
        val fetched = runCatching { Instant.parse(delivery.fetchedAt) }.getOrNull() ?: return absent
        if (fetched.isAfter(now) || Duration.between(fetched,now).seconds > MAX_AGE) return absent
        val stationName = delivery.snapshot.station.name
        if (expectedStationNumber == RIO_PORT_STATION &&
            !stationName.contains("RIO DE JANEIRO",ignoreCase=true)) return absent
        fun next(phase: String): String {
            val entry = delivery.snapshot.predictions.asSequence()
                .filter { it.phase == phase }
                .mapNotNull { p ->
                    val at=runCatching { Instant.parse(p.instantUtc) }.getOrNull()
                    if (at == null || at.isBefore(now)) null else at to p.heightMeters
                }.minByOrNull { it.first }
            return entry?.let { (at,height) ->
                String.format(Locale("pt","BR"), "%.2f m • %s",
                    height, at.atZone(tz).format(fmt))
            } ?: "—"
        }
        val high=next("HIGH")
        val low=next("LOW")
        if (high=="—" && low=="—")return absent
        return RjOfficialTideReadout(
            "PREVISAO_CHM_VIGENTE",stationName,high,low,
            "Previsão de tábua oficial CHM, não maré observada instantaneamente",
            fetched,true)
    }
}
