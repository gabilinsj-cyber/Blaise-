package br.com.blaise.rj

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
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

    private fun assertTextDisplayed(text: String) {
        rule.onNodeWithText(text).performScrollTo().assertIsDisplayed()
    }

    private fun assertCoreDashboard() {
        assertTextDisplayed("BLAISE V6 RJ")
        assertTextDisplayed("STATUS OFICIAL • AGUARDANDO DADOS")
        assertTextDisplayed("Não presumimos ausência de alerta sem evidência oficial válida.")
        assertTrue(rule.onAllNodesWithText("TEMPO ESTÁVEL • SEM ALERTAS P0").fetchSemanticsNodes().isEmpty())
        assertTextDisplayed("P0 oficial permanece disponível sem assinatura.")
        assertTextDisplayed("Conteúdo premium exige entitlement ativo.")
        assertTextDisplayed("Cidade 1")
        assertTextDisplayed("Cidade 2")
        assertTextDisplayed("Escolher cidade 1")
        assertTextDisplayed("Escolher cidade 2")
        assertTextDisplayed("Assinatura Google Play")
        assertTextDisplayed("Não configurada nesta build • premium bloqueado")
    }

    private fun assertCriticalStatusVisible() {
        assertTextDisplayed("BLAISE V6 RJ")
        assertTextDisplayed("STATUS OFICIAL • AGUARDANDO DADOS")
        assertTrue(rule.onAllNodesWithText("TEMPO ESTÁVEL • SEM ALERTAS P0").fetchSemanticsNodes().isEmpty())
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
        rule.waitForIdle()
        assertCriticalStatusVisible()

        rule.activityRule.scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
        rule.waitUntil(timeoutMillis = 15_000) { rule.activity.resources.configuration.orientation == Configuration.ORIENTATION_PORTRAIT }
        rule.waitForIdle()
        assertCoreDashboard()
    }

    @Test fun citySelectionSearchesAllMunicipalitiesAndSurvivesRecreation() {
        rule.onNodeWithText("Escolher cidade 1").performScrollTo().performClick()
        rule.onNodeWithTag("city-search").performTextInput("sao goncalo")
        rule.onNodeWithTag("city-option-3304904").performClick()
        rule.waitForIdle()
        rule.onNodeWithText("São Gonçalo").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("IBGE 3304904").performScrollTo().assertIsDisplayed()
        rule.activityRule.scenario.recreate()
        rule.waitForIdle()
        rule.onNodeWithText("São Gonçalo").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("IBGE 3304904").performScrollTo().assertIsDisplayed()
    }
}
