package br.com.blaise.rj

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
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
        assertTextDisplayed("Clima e Tempo")
        assertTextDisplayed("Blaise • Como posso ajudar?")
        assertTextDisplayed("ESTADO DO RIO DE JANEIRO")
        assertTextDisplayed("Mapa geográfico com 92 municípios • visão estadual")
        assertTextDisplayed("Início")
        assertTextDisplayed("STATUS OFICIAL • AGUARDANDO DADOS")
        assertTextDisplayed("Não presumimos ausência de alerta sem evidência oficial válida.")
        assertTrue(rule.onAllNodesWithText("TEMPO ESTÁVEL • SEM ALERTAS P0").fetchSemanticsNodes().isEmpty())
        assertTextDisplayed("Cidade 1")
        assertTextDisplayed("Cidade 2")
        assertTextDisplayed("Escolher cidade 1")
        assertTextDisplayed("Escolher cidade 2")
    }

    private fun assertCriticalStatusVisible() {
        assertTextDisplayed("BLAISE V6 RJ")
        assertTextDisplayed("Clima e Tempo")
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

    @Test fun assistantRoutesQuestionsWithoutInventingLiveConditions() {
        rule.onNodeWithTag("assistant-input").performTextInput("Tem tornado no Rio?")
        rule.onNodeWithTag("assistant-send").performClick()
        rule.waitForIdle()
        assertTextDisplayed("Entendi a pergunta para Rio de Janeiro, mas ainda não tenho dados oficiais validados para esse assunto. Não posso confirmar condições ou riscos agora.")
    }

    @Test fun voiceControlsRespectPowerAndSilentMode() {
        val preferences = rule.activity.getSharedPreferences("blaise-ui-state", android.content.Context.MODE_PRIVATE)
        val previousPower = preferences.getBoolean("power_on", true)
        val previousSilent = preferences.getBoolean("silent_mode", false)
        try {
            preferences.edit().putBoolean("power_on", true).putBoolean("silent_mode", false).commit()
            rule.activityRule.scenario.recreate()
            rule.onNodeWithTag("assistant-test-dora").assertIsEnabled()
            rule.onNodeWithTag("nav-Mais").performScrollTo().performClick()
            rule.onNodeWithTag("settings-silent-toggle").performScrollTo().performClick()
            rule.onNodeWithTag("assistant-read-answer").assertIsNotEnabled()
            rule.onNodeWithTag("settings-silent-toggle").performScrollTo().performClick()
            rule.onNodeWithTag("assistant-read-answer").assertIsEnabled()
            rule.onNodeWithTag("settings-power-toggle").performScrollTo().performClick()
            rule.onNodeWithTag("assistant-test-dora").assertIsNotEnabled()
            rule.onNodeWithTag("assistant-microphone").assertIsNotEnabled()
        } finally {
            preferences.edit().putBoolean("power_on", previousPower).putBoolean("silent_mode", previousSilent).commit()
        }
    }

    @Test fun referenceHomeContainsScientificAgentsAndOfficialServicePanels() {
        rule.onNodeWithTag("scientific-calculator-panel").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("ten-agents-panel").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("traffic-official-status").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("air-quality-official-status").performScrollTo().assertIsDisplayed()
        assertTextDisplayed("10 agentes cadastrados • execução autônoma em produção ainda não validada.")
        assertTextDisplayed("CÁLCULO BLAISE • NÃO É MEDIÇÃO OFICIAL")
    }

    @Test fun tenAgentDescriptionsAreAccessibleWithoutSimulatingProduction() {
        rule.onNodeWithTag("nav-Mais").performScrollTo().performClick()
        assertTextDisplayed("BLAISE • 10 AGENTES CIENTÍFICOS E DE SEGURANÇA")
        rule.onNodeWithText("Ver funções dos 10 agentes").performScrollTo().performClick()
        assertTextDisplayed("1. Blaise Sentinel RJ")
        assertTextDisplayed("10. Auditoria Profunda RJ")
    }

    @Test fun supplementalMapOverlaysDoNotInventTrafficSeismicOrRadarLayers() {
        rule.onNodeWithTag("map-extra-Cidades").performScrollTo().performClick()
        assertTextDisplayed("Cidades: limites geográficos dos 92 municípios exibidos no mapa, sem dados meteorológicos simulados.")
        rule.onNodeWithTag("map-extra-Satélite").performScrollTo().performClick()
        assertTextDisplayed("Satélite: camada geográfica/meteorológica adicional indisponível até fonte oficial autorizada, dados atuais e georreferenciamento validado.")
    }

    @Test fun geographicMapNeverClaimsToBeOfficialRadar() {
        assertTextDisplayed("92 municípios • não é radar")
        assertTextDisplayed("Radar: sem medição pontual recente validada; radar e mapas interpolados indisponíveis.")
    }
}
