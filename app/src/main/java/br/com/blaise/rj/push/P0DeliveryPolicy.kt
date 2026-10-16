package br.com.blaise.rj.push

import br.com.blaise.rj.core.City
import br.com.blaise.rj.core.OfficialAlert

/**
 * Enforces municipality scoping after the P0 payload has passed canonical parsing.
 * State-wide alerts remain visible to every subscriber; municipality-scoped alerts
 * are delivered only when the affected municipality is one of the two selected slots.
 */
object P0DeliveryPolicy {
    fun shouldDeliver(alert: OfficialAlert, selectedCities: Collection<City>): Boolean {
        val targetCity = alert.city ?: return true
        return selectedCities.any { selected -> selected.ibgeCode == targetCity.ibgeCode }
    }
}
