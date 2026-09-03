package br.com.blaise.rj.domain

import br.com.blaise.rj.core.City
import br.com.blaise.rj.data.AlertRepository
import br.com.blaise.rj.data.WeatherRepository

data class Dashboard(val cities: List<City>, val temperatures: Map<String, Double>, val officialAlertCount: Int)

class BlaiseCoordinator(private val weather: WeatherRepository, private val alerts: AlertRepository) {
    suspend fun refresh(cities: List<City>): Dashboard {
        require(cities.size in 1..2) { "Select one or two municipalities" }
        val temperatures = cities.mapNotNull { city ->
            weather.current(city).getOrNull()?.let { city.name to it.temperatureC }
        }.toMap()
        val official = cities.flatMap { alerts.official(it).getOrDefault(emptyList()) }.distinctBy { it.id }
        return Dashboard(cities, temperatures, official.size)
    }
}

