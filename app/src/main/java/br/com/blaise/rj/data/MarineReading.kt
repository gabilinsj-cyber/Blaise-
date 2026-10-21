package br.com.blaise.rj.data

import java.time.Instant

data class MarineReading(
    val cityIbge: Int,
    val sourceName: String,
    val sourceUrl: String,
    val nature: String,
    val issuedAt: Instant,
    val validAt: Instant,
    val expiresAt: Instant,
    val waveHeightM: Double?,
    val wavePeriodS: Double?,
    val waveDirectionDeg: Double?,
    val windSpeedKmh: Double?,
    val startsAt: Instant?,
    val endsAt: Instant?,
    val affectedRegion: String?,
    val blaiseScale: Int?,
    val dangerSummary: String?
)
 {
    init {
        require(nature in setOf("OBSERVADO", "MODELO"))
        require(sourceName.isNotBlank() && sourceName.length <= 160)
        val uri = java.net.URI(sourceUrl)
        require(uri.scheme == "https" && !uri.host.isNullOrBlank())
        require(uri.rawUserInfo == null)
        require(expiresAt.isAfter(issuedAt))
        require(waveHeightM == null ||
            (waveHeightM.isFinite() && waveHeightM >= 0))
        require(wavePeriodS == null ||
            (wavePeriodS.isFinite() && wavePeriodS > 0))
        require(waveDirectionDeg == null ||
            (waveDirectionDeg.isFinite() &&
             waveDirectionDeg >= 0 && waveDirectionDeg < 360))
        require(windSpeedKmh == null ||
            (windSpeedKmh.isFinite() && windSpeedKmh >= 0))
        require(blaiseScale == null || blaiseScale in 1..5)
        require(startsAt == null || endsAt == null ||
            endsAt.isAfter(startsAt))
    }
}
