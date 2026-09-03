package br.com.blaise.rj

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainActivityTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()
    @Test fun dashboardDisplaysP0StatusAndTwoCities() {
        rule.onNodeWithText("TEMPO ESTÁVEL • SEM ALERTAS P0").assertIsDisplayed()
        rule.onNodeWithText("Cidade 1").assertIsDisplayed()
        rule.onNodeWithText("Cidade 2").assertIsDisplayed()
    }
}

