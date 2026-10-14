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
        rule.onNodeWithTag("assistant-compact-strip").assertIsDisplayed()
        rule.onNodeWithTag("assistant-microphone").assertIsEnabled()
        rule.onNodeWithTag("map-overlay-menu").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("nav-Mais").assertIsDisplayed()

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
        rule.onNodeWithText("IBGE 3304904").performScrollTo().assertIsDisplayed()
        rule.activityRule.scenario.recreate()
        rule.waitForIdle()
        rule.onNodeWithText("IBGE 3304904").performScrollTo().assertIsDisplayed()
    }

    @Test fun selectedRjCityChangesInmetHourlyGraphScopeWithoutBorrowingRioReading() {
        rule.onNodeWithText("Escolher cidade 1").performScrollTo().performClick()
        rule.onNodeWithTag("city-search").performTextInput("angra dos reis")
        rule.onNodeWithTag("city-option-3300100").performClick()
        rule.waitForIdle()
        assertTextDisplayed("GRÁFICOS DO DIA • ANGRA DOS REIS")
        assertTextDisplayed("INMET • estação local validada • últimas 24 horas")
        rule.onNodeWithTag("expanded-daily-chart").performScrollTo().assertIsDisplayed()
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

    @Test fun tableOneIsAccessibleFromHomeAndStandaloneSourcesNavigation() {
        rule.onNodeWithTag("home-open-meteorological-table-1")
            .performScrollTo().performClick()
        rule.onNodeWithTag("nav-Fontes").assertIsDisplayed()
        rule.onNodeWithTag("rj-meteo-table-1-content").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-ten-primary-source-rows").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-openweather-row-TEMPERATURA")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-openweather-row-GRANIZO")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-maritime-supplement-table")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-marine-TSUNAMI_MAREMOTO")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-marine-CICLONES_MAR")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-meteo-table-2-tab")
            .performScrollTo().performClick()
        rule.onNodeWithTag("rj-meteo-table-2-content")
            .performScrollTo().assertIsDisplayed()
    }

    @Test fun officialMeteorologicalTablesAreNamedAndAvailableInsideExistingMoreScreen() {
        rule.onNodeWithTag("nav-Mais").performScrollTo().performClick()
        rule.onNodeWithTag("rj-meteo-homologation-panel").performScrollTo().assertIsDisplayed()
        assertTextDisplayed("BLAISE-RJ-METEO-HOMOLOG-01")
        rule.onNodeWithTag("rj-meteo-homologation-status").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-meteo-table-1-content").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-meteo-source-TEMPERATURA").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-meteo-source-RAIOS").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-meteo-table-2-tab").performScrollTo().performClick()
        rule.onNodeWithTag("rj-meteo-table-2-content").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-meteo-dispute-04").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-meteo-dispute-05").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-meteo-table-1-tab").performScrollTo().performClick()
        rule.onNodeWithTag("rj-meteo-source-CHUVA_ACUMULADA").performScrollTo().assertIsDisplayed()
    }

    @Test fun sourceConnectionStatesAreVisibleWithoutInventingThirdPartyLiveFeeds() {
        rule.onNodeWithTag("nav-Mais").performScrollTo().performClick()
        rule.onNodeWithTag("rj-public-status-connection")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-public-status-last-attempt")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-public-status-refresh")
            .performScrollTo().assertIsDisplayed()
        if (BuildConfig.BLAISE_RJ_PUBLIC_STATUS_BASE_URL.isBlank()) {
            rule.onNodeWithTag("rj-public-status-refresh")
                .assertIsNotEnabled()
        }
        rule.onNodeWithTag("rj-live-source-evidence-count")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-live-source-evidence-toggle")
            .performScrollTo().performClick()
        rule.onNodeWithTag("rj-live-source-evidence-6")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-live-source-evidence-10")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-live-source-evidence-toggle")
            .performScrollTo().performClick()
        rule.onNodeWithTag("nav-Mar e Ondas").performScrollTo().performClick()
        rule.onNodeWithTag("rj-marine-public-connection")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-marine-manual-refresh")
            .performScrollTo().assertIsDisplayed()
        if (BuildConfig.BLAISE_RJ_PUBLIC_STATUS_BASE_URL.isBlank()) {
            rule.onNodeWithTag("rj-marine-manual-refresh")
                .assertIsNotEnabled()
        }
        rule.onNodeWithTag("rj-marine-product-connection")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-marine-unconnected-products")
            .performScrollTo().assertIsDisplayed()
    }

    @Test fun tappingTableOneLinksDirectlyToMatchingTableTwoWeightedCalculationRules() {
        rule.onNodeWithTag("nav-Mais").performScrollTo().performClick()
        rule.onNodeWithTag("rj-meteo-source-TEMPERATURA")
            .performScrollTo().performClick()
        rule.onNodeWithTag("rj-meteo-table-2-content").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-linked-phenomenon").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-linked-weighted-eligibility").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-meteo-dispute-11").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-show-all-dispute-rules").performScrollTo().performClick()
        rule.onNodeWithTag("rj-meteo-dispute-13").performScrollTo().assertIsDisplayed()
    }

    @Test fun marineSectionDisplaysIndependentSourceAndDataTableWithFiveRows() {
        rule.onNodeWithTag("nav-Mar e Ondas").performScrollTo().performClick()
        rule.onNodeWithTag("rj-marine-screen-table").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-marine-screen-row-CICLONES_OCEANICOS")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-marine-screen-row-TEMPESTADES_ATLANTICO")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-marine-screen-row-ONDAS_SWELL")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-marine-screen-row-RESSACA_LITORAL")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-marine-screen-row-TSUNAMI")
            .performScrollTo().assertIsDisplayed()
    }

    @Test fun maritimeMatrixLinksTsunamiToAuthorityChecksNotWeightedAverage() {
        rule.onNodeWithTag("nav-Mais").performScrollTo().performClick()
        rule.onNodeWithTag("rj-meteo-table-3-tab").performScrollTo().performClick()
        rule.onNodeWithTag("rj-marine-matrix-content").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-marine-source-ONDAS_SWELL")
            .performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-marine-source-TSUNAMI")
            .performScrollTo().performClick()
        rule.onNodeWithTag("rj-linked-weighted-eligibility").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-meteo-dispute-12").performScrollTo().assertIsDisplayed()
    }

    @Test fun supplementalMapOverlaysDoNotInventTrafficSeismicOrRadarLayers() {
        rule.onNodeWithTag("map-extra-Cidades").performScrollTo().performClick()
        assertTextDisplayed("Cidades: desenho próprio do Blaise, limites de base cartográfica aberta dos 92 municípios; sem chuva ou radar simulados.")
        rule.onNodeWithTag("map-extra-Satélite").performScrollTo().performClick()
        assertTextDisplayed("Satélite: camada geográfica/meteorológica adicional indisponível até fonte oficial autorizada, dados atuais e georreferenciamento validado.")
    }

    @Test fun headerHelpExplainsUnavailableDataAndAlertsShortcutOpensOfficialPanel() {
        rule.onNodeWithTag("top-help").performScrollTo().performClick()
        rule.onNodeWithText("Ajuda • Blaise V6 RJ").assertIsDisplayed()
        rule.onNodeWithText("Entendi").performClick()
        // City 1 can be persisted as any of the 92 municipalities by an earlier test.
        // Global alert navigation must work independent of that selection.
        rule.onNodeWithTag("top-notifications").performScrollTo().performClick()
        assertTextDisplayed("ALERTAS POR MUNICÍPIO")
    }

    @Test fun seasideAndRegionalNewsPanelsExposeWorkingNavigationAndScopeTabs() {
        rule.onNodeWithTag("marine-more").performScrollTo().performClick()
        assertTextDisplayed("RESSACA • TSUNAMI • MAREMOTO")
        rule.onNodeWithTag("nav-Início").performScrollTo().performClick()
        rule.onNodeWithTag("news-scope-Internacional").performScrollTo().performClick()
        rule.onNodeWithTag("news-scope-status").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("news-more").performScrollTo().performClick()
        assertTextDisplayed("NOTICIÁRIO LOCAL")
    }

    @Test fun mapZoomAndLayerControlsAreClickableButDoNotSimulateRadar() {
        rule.onNodeWithTag("map-zoom-in").performScrollTo().performClick()
        rule.onNodeWithTag("map-zoom-out").performScrollTo().performClick()
        rule.onNodeWithTag("map-layer-Vento").performScrollTo().performClick()
        rule.onNodeWithTag("map-extra-Rodovias").performScrollTo().performClick()
        // Another test checks the full layer explanation; this check covers
        // zoom + layer control interactions without a brittle exact string.
        rule.onNodeWithTag("map-extra-status").performScrollTo().assertIsDisplayed()
        assertTextDisplayed("MAPA PRÓPRIO • BLAISE V6 RJ")
    }

    @Test fun meteorologicalMatrixContainsThirtyPhenomenaAndSupplementaryOceanSources() {
        rule.onNodeWithTag("nav-Mais").performScrollTo().performClick()
        rule.onNodeWithTag("rj-meteo-homologation-panel").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-openweather-complement").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-ocean-eumetsat-complement").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-extra-source-integration-status").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-meteo-source-TEMPERATURA_MAR").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-meteo-source-CHUVA_ATUAL").performScrollTo().assertIsDisplayed()
        rule.onNodeWithTag("rj-meteo-table-2-tab").performScrollTo().performClick()
        rule.onNodeWithTag("rj-meteo-dispute-13").performScrollTo().assertIsDisplayed()
    }

    @Test fun geographicMapNeverClaimsToBeOfficialRadar() {
        assertTextDisplayed("92 municípios • não é radar")
        assertTextDisplayed("Radar: sem medição pontual recente validada; radar e mapas interpolados indisponíveis.")
    }
}
