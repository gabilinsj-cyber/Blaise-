package br.com.blaise.rj

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.lifecycle.Lifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainActivityTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    private fun assertCoreDashboard() {
        rule.onNodeWithText("BLAISE V6 RJ").assertIsDisplayed()
        rule.onNodeWithText("TEMPO ESTÁVEL • SEM ALERTAS P0").assertIsDisplayed()
        rule.onNodeWithText("Cidade 1").assertIsDisplayed()
        rule.onNodeWithText("Cidade 2").assertIsDisplayed()
    }

    @Test fun dashboardDisplaysP0StatusAndTwoCities() {
        assertCoreDashboard()
    }

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
        rule.activityRule.scenario.onActivity {
            it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        }
        rule.waitUntil(timeoutMillis = 15_000) {
            rule.activity.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        }
        assertCoreDashboard()

        rule.activityRule.scenario.onActivity {
            it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        }
        rule.waitUntil(timeoutMillis = 15_000) {
            rule.activity.resources.configuration.orientation == Configuration.ORIENTATION_PORTRAIT
        }
        assertCoreDashboard()
    }
}
