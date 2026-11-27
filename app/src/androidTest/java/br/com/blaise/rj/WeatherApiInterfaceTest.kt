package br.com.blaise.rj

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import br.com.blaise.rj.core.City
import br.com.blaise.rj.data.*
import java.time.Instant
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class WeatherApiInterfaceTest {

    @get:Rule
    val rule = createComposeRule()

    // Dados sinteticos exclusivos para teste.
    private val valid =
        Instant.parse("2025-01-01T12:00:00Z")

    private val checked =
        Instant.parse("2025-01-01T12:05:00Z")

    private fun prepare(now: Instant) {
        val weather = DashboardWeatherApiCurrent(
            3304557, valid, checked,
            25.2, 26.3, 72.0,
            11.4, 22.8, 0.02,
            88.0, 1012.0, 4.2, "CHUVA"
        )

        val thermal = ApprovedThermalDisplay(
            3304557, "WEATHERAPI_FREE", "E",
            valid, checked, 25.2, 26.3, "CHUVA"
        )

        val selected =
            ApprovedThermalMunicipalSelection.select(
                listOf(thermal), now
            )

        rule.setContent {
            MaterialTheme {
                CompositionLocalProvider(
                    LocalObservationClock provides now,
                    LocalWeatherApi provides
                        mapOf(3304557 to weather)
                            .filterValues { it.current(now) },
                    LocalApprovedThermal provides
                        (selected?.let {
                            mapOf(3304557 to it)
                        } ?: emptyMap())
                ) {
                    Column(
                        Modifier.verticalScroll(
                            rememberScrollState()
                        )
                    ) {
                        CityPanel(
                            label = "Cidade 1",
                            city = City("Rio de Janeiro", 3304557),
                            chooseLabel = "Escolher cidade 1",
                            onChoose = {}
                        )
                    }
                }
            }
        }
    }

    @Test
    fun displaysWeatherMeters() {
        prepare(valid.plusSeconds(600))

        for (value in listOf(
            "25,2 °C",
            "26,3 °C",
            "72,0 %",
            "11,4 km/h",
            "22,8 km/h",
            "0,02 mm",
            "88,0 %",
            "1012,0 hPa",
            "4,2 índice",
            "CHUVA"
        )) {
            rule.onAllNodesWithText(
                value, substring = true
            ).onFirst()
                .performScrollTo()
                .assertIsDisplayed()
        }
    }

    @Test
    fun hidesExpiredWeatherSample() {
        prepare(valid.plusSeconds(2160))

        rule.onNodeWithText("25,2 °C")
            .assertDoesNotExist()

        rule.onNodeWithText("26,3 °C", substring = true)
            .assertDoesNotExist()

        rule.onNodeWithText("0,02 mm")
            .assertDoesNotExist()
    }
}
