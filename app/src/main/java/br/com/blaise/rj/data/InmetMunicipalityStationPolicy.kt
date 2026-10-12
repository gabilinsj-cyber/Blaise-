package br.com.blaise.rj.data

import br.com.blaise.rj.assistant.normalizedSpeech
import br.com.blaise.rj.cities.RioMunicipalities
import br.com.blaise.rj.core.City

/**
 * An INMET weather station must belong to the EXACT selected RJ municipality.
 * Never substitute a neighboring municipality, a station in another state,
 * a disabled station, or a station from a different provider.
 *
 * This selection only grants eligibility to try the INMET endpoint: it is NOT
 * evidence of a fresh weather reading, nor a whole-municipality average.
 */
data class InmetCatalogStation(
    val code: String,
    val name: String,
    val state: String,
    val provider: String,
    val operationalStatus: String,
    val latitude: Double?,
    val longitude: Double?,
)

object InmetMunicipalityStationPolicy {
    fun select(city: City, catalog: List<InmetCatalogStation>): List<InmetCatalogStation> {
        if (RioMunicipalities.byIbgeCode(city.ibgeCode)?.name != city.name ||
            catalog.size > 2000
        ) return emptyList()

        val selectedName = normalizedSpeech(city.name)
        val isRioCity = city.ibgeCode == 3304557
        return catalog.asSequence().filter { station ->
            val name = normalizedSpeech(station.name)
            val correctName = name == selectedName || (
                isRioCity && name.startsWith("$selectedName ") &&
                    (station.name.contains("-") || station.name.contains("/"))
            )
            station.state == "RJ" &&
                station.provider == "INMET" &&
                station.operationalStatus == "Operante" &&
                Regex("[AB][0-9]{3}").matches(station.code) &&
                correctName &&
                station.latitude?.isFinite() == true &&
                station.latitude in -23.7..-20.4 &&
                station.longitude?.isFinite() == true &&
                station.longitude in -45.5..-40.4
        }.distinctBy { it.code }.sortedWith(
            compareBy<InmetCatalogStation> {
                if (isRioCity && it.code == "A652") 0 else 1
            }.thenBy { it.code }
        ).take(4).toList()
    }
}
