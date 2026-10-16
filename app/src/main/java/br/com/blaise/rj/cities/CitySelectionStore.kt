package br.com.blaise.rj.cities

import android.content.Context
import br.com.blaise.rj.core.City

class CitySelectionStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun load(slot: Int): City {
        val fallback = defaultFor(slot)
        val storedCode = prefs.getInt(keyFor(slot), fallback.ibgeCode)
        return RioMunicipalities.byIbgeCode(storedCode) ?: fallback
    }

    fun save(slot: Int, city: City) {
        require(slot == 1 || slot == 2) { "Only city slots 1 and 2 are supported" }
        require(RioMunicipalities.byIbgeCode(city.ibgeCode) != null) { "City must belong to RJ" }
        prefs.edit().putInt(keyFor(slot), city.ibgeCode).apply()
    }

    private fun defaultFor(slot: Int): City = when (slot) {
        1 -> requireNotNull(RioMunicipalities.byIbgeCode(3304557))
        2 -> requireNotNull(RioMunicipalities.byIbgeCode(3303302))
        else -> error("Only city slots 1 and 2 are supported")
    }

    private fun keyFor(slot: Int): String = when (slot) {
        1 -> KEY_CITY_1
        2 -> KEY_CITY_2
        else -> error("Only city slots 1 and 2 are supported")
    }

    private companion object {
        const val PREFS_NAME = "blaise_city_selection"
        const val KEY_CITY_1 = "city_1_ibge"
        const val KEY_CITY_2 = "city_2_ibge"
    }
}
