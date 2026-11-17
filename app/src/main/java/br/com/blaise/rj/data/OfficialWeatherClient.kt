package br.com.blaise.rj.data

import br.com.blaise.rj.assistant.WeatherRequest
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * Consumer-facing legacy bridge is permanently disabled for INMET/CEMADEN.
 * They are admin-side domestic divergence comparators, never data suppliers
 * for the subscriber application. No public API polling happens here.
 * Weather values can return only via a future authenticated international
 * adapter with validated source, place, category and actual data timestamp.
 */
class OfficialWeatherClient {
    suspend fun currentCity(request: WeatherRequest): CityWeatherResult =
        CityWeatherResult(
            municipalityIbge = request.city.ibgeCode,
            localScope = request.localScope,
            unavailableReason = "Dados internacionais ainda indisponíveis para esta localidade.",
        )

    suspend fun currentRioStations(): List<CityWeatherObservation> = emptyList()

    suspend fun answer(request: WeatherRequest, severity: Int = 1): String =
        "Os dados meteorológicos internacionais para ${request.localScope ?: request.city.name} " +
            "ainda não estão validados nesta consulta. Não posso informar valores não confirmados."
}

// Pure parser retained for legacy tests/admin migration only. It performs
// no network access and is not invoked to supply subscriber measurements.
object OfficialWeatherParser {
    fun number(row: JSONObject, key: String, min: Double, max: Double): Double? =
        row.optString(key).replace(',', '.').toDoubleOrNull()?.takeIf { it.isFinite() && it in min..max && it != 9999.0 }
    fun observedAt(row: JSONObject): Instant? = runCatching {
        val date = LocalDate.parse(row.getString("DT_MEDICAO").take(10))
        val hour = row.getString("HR_MEDICAO").padStart(4, '0')
        date.atTime(hour.take(2).toInt(), hour.takeLast(2).toInt()).toInstant(ZoneOffset.UTC)
    }.getOrNull()
}
