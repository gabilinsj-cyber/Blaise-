package br.com.blaise.rj

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.lifecycle.Lifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainActivityTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    private fun assertCoreDashboard() {
        rule.onNodeWithText("BLAISE V6 RJ").assertIsDisplayed()
        rule.onNodeWithText("STATUS OFICIAL • AGUARDANDO DADOS").assertIsDisplayed()
        rule.onNodeWithText("Não presumimos ausência de alerta sem evidência oficial válida.").assertIsDisplayed()
        assertTrue(rule.onAllNodesWithText("TEMPO ESTÁVEL • SEM ALERTAS P0").fetchSemanticsNodes().isEmpty())
        rule.onNodeWithText("P0 oficial permanece disponível sem assinatura.").assertIsDisplayed()
        rule.onNodeWithText("Conteúdo premium exige entitlement ativo.").assertIsDisplayed()
        rule.onNodeWithText("Cidade 1").assertIsDisplayed()
        rule.onNodeWithText("Cidade 2").assertIsDisplayed()
        rule.onNodeWithText("Escolher cidade 1").assertIsDisplayed()
        rule.onNodeWithText("Escolher cidade 2").assertIsDisplayed()
    }

    @Test fun dashboardFailsClosedWithoutOfficialAlertEvidence() { assertCoreDashboard() }

    @Test fun dashboardSurvivesActivityRecreation() {
        assertCoreDashboard()
        rule.activityRule.scenario.recreate()
        rule.waitForIdle()
        assertCoreDashboard()
    }

    @Test fun dashboardSurvivesBackgroundForeground() {
        rule.activityRule.scenario.moveToState(Lifecycle.State.CREATED)
        rule.activityRule.scenario.moveToState(Lifecycle.State.RESUMED)
        rule.waitForIdle()
        assertCoreDashboard()
    }

    @Test fun dashboardSurvivesPortraitLandscapeTransitions() {
        rule.activityRule.scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
        rule.waitUntil(timeoutMillis = 15_000) { rule.activity.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE }
        assertCoreDashboard()
        rule.activityRule.scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
        rule.waitUntil(timeoutMillis = 15_000) { rule.activity.resources.configuration.orientation == Configuration.ORIENTATION_PORTRAIT }
        assertCoreDashboard()
    }

    @Test fun citySelectionSearchesAllMunicipalitiesAndSurvivesRecreation() {
        rule.onNodeWithText("Escolher cidade 1").performClick()
        rule.onNodeWithTag("city-search").performTextInput("sao goncalo")
        rule.onNodeWithTag("city-option-3304904").performClick()
        rule.waitForIdle()
        rule.onNodeWithText("São Gonçalo").assertIsDisplayed()
        rule.onNodeWithText("IBGE 3304904").assertIsDisplayed()
        rule.activityRule.scenario.recreate()
        rule.waitForIdle()
        rule.onNodeWithText("São Gonçalo").assertIsDisplayed()
        rule.onNodeWithText("IBGE 3304904").assertIsDisplayed()
    }
}
