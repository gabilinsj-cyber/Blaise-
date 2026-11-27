package br.com.blaise.rj

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import br.com.blaise.rj.core.City
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CompletableDeferred
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GuardianCleanInterfaceTest {

    @get:Rule
    val rule = createComposeRule()

    private val now = AtomicLong(0L)
    private val retention = 86400000L
    private val timer = CompletableDeferred<Unit>()
    private val response = CompletableDeferred<String>()
    private val started = CompletableDeferred<Unit>()

    private val initial =
        "Pronto para orientar sem criar dados ou alertas."

    private fun prepare() {
        rule.setContent {
            MaterialTheme {
                Column(
                    Modifier.verticalScroll(
                        rememberScrollState()
                    )
                ) {
                    AssistantPanel(
                        selectedCity = City("Niterói", 3303302),
                        onNavigate = {},
                        voiceEnabled = false,
                        appEnabled = true,
                        guardianNowMs = { now.get() },
                        guardianWait = { timer.await() },
                        guardianWeatherAnswer = {
                            started.complete(Unit)
                            response.await()
                        }
                    )
                }
            }
        }

        rule.onNodeWithText("Digite aqui… ⤢")
            .performScrollTo().performClick()

        rule.onNodeWithTag("assistant-input")
            .performTextInput("Temperatura em Niterói")

        rule.onNodeWithTag("assistant-send")
            .performScrollTo().performClick()

        rule.waitUntil(5000) {
            started.isCompleted
        }
    }

    private fun assertCleared() {
        rule.waitUntil(5000) {
            rule.onAllNodesWithText(initial)
                .fetchSemanticsNodes().isNotEmpty()
        }

        rule.onNodeWithTag("assistant-answer")
            .assertTextEquals(initial)

        rule.onNodeWithTag("assistant-send")
            .assertIsNotEnabled()
    }

    @Test
    fun clearsVisibleConversationAfter24Hours() {
        prepare()
        response.complete("RESPOSTA FICTICIA DE TESTE")

        rule.waitUntil(5000) {
            rule.onAllNodesWithText(
                "RESPOSTA FICTICIA DE TESTE"
            ).fetchSemanticsNodes().isNotEmpty()
        }

        rule.runOnIdle {
            now.set(retention - 1)
        }

        rule.onNodeWithTag("assistant-answer")
            .assertTextEquals("RESPOSTA FICTICIA DE TESTE")

        rule.runOnIdle {
            now.set(retention)
            timer.complete(Unit)
        }

        assertCleared()
    }

    @Test
    fun blocksLateResponseAfterExpiration() {
        prepare()

        rule.runOnIdle {
            now.set(retention)
            response.complete("RESPOSTA ATRASADA")
        }

        assertCleared()

        rule.onNodeWithText("RESPOSTA ATRASADA")
            .assertDoesNotExist()
    }
}
