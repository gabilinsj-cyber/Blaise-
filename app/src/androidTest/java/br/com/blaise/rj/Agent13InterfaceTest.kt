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
import androidx.test.platform.app.InstrumentationRegistry

import br.com.blaise.rj.core.City
import br.com.blaise.rj.data.*

import org.json.JSONObject
import org.json.JSONArray
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Instant

@RunWith(AndroidJUnit4::class)
class Agent13InterfaceTest {

    @get:Rule
    val rule = createComposeRule()

    private fun decode(value: Any?): Any? =
        when(value) {
            null, JSONObject.NULL -> null
            is JSONObject ->
                value.keys().asSequence().associateWith {
                    decode(value.get(it))
                }
            is JSONArray ->
                (0 until value.length()).map {
                    decode(value.get(it))
                }
            else -> value
        }

    private fun prepare(expired: Boolean) {

        val context =
            InstrumentationRegistry
                .getInstrumentation().context

        val json = context.assets.open(
            "agent13-dashboard-fixture.json"
        ).bufferedReader().use { it.readText() }

        @Suppress("UNCHECKED_CAST")
        val payload = decode(JSONObject(json))
            as Map<String, Any?>

        val snapshot =
            DashboardDataParser.parse(payload)

        val now = if(expired)
            snapshot.generatedAt.plusSeconds(3601)
        else snapshot.generatedAt

        val thermal = snapshot.approvedThermal
            .filter { it.valid(now) }
            .groupBy { it.ibge }
            .mapNotNull { (code, rows) ->
                ApprovedThermalMunicipalSelection
                    .select(rows, now)
                    ?.let { code to it }
            }.toMap()

        rule.setContent {
            MaterialTheme {
                CompositionLocalProvider(
                    LocalObservationClock provides now,
                    LocalApprovedThermal provides thermal
                ) {
                    Column(
                        Modifier.verticalScroll(
                            rememberScrollState()
                        )
                    ) {
                        CityPanel(
                            label = "Localidade 1",
                            city = City(
                                "Rio de Janeiro", 3304557
                            ),
                            chooseLabel = "Escolher cidade 1",
                            onChoose = {}
                        )

                        CityPanel(
                            label = "Localidade 2",
                            city = City(
                                "Niterói", 3303302
                            ),
                            chooseLabel = "Escolher cidade 2",
                            onChoose = {}
                        )
                    }
                }
            }
        }
    }

    @Test
    fun displaysBothMunicipalities() {
        prepare(false)

        rule.onNodeWithText("25,0 °C")
            .performScrollTo()
            .assertIsDisplayed()

        rule.onNodeWithText("24,0 °C")
            .performScrollTo()
            .assertIsDisplayed()

        rule.onAllNodesWithText(
            "26,0 °C", substring = true
        ).assertCountEquals(2)
    }

    @Test
    fun hidesExpiredThermalData() {
        prepare(true)

        for(value in listOf(
            "25,0 °C", "24,0 °C", "26,0 °C"
        )) {
            rule.onAllNodesWithText(
                value, substring = true
            ).assertCountEquals(0)
        }
    }
}
