package br.com.blaise.rj

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import br.com.blaise.rj.data.OceanModelPoint
import br.com.blaise.rj.data.OceanModelRow
import br.com.blaise.rj.data.OceanTidesCurrents
import java.time.Instant
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OceanTidesCurrentsPanelTest {
    @get:Rule val compose = createComposeRule()
    private val now=Instant.parse("2026-10-17T03:30:00Z")
    @Test fun missingProductNeverDisplaysInventedTide() {
        compose.setContent { MaterialTheme { RjOceanTidesCurrentsPanel(null,now) } }
        compose.onNodeWithText("Sem previsão de maré e correntes validada nesta consulta.").assertIsDisplayed()
    }
    @Test fun datedSyntheticModelIsLabelledAndRendered() {
        val data=OceanTidesCurrents(now,
            OceanModelPoint(-23.5,-43.0,null,listOf(OceanModelRow(now,tideM=-0.2,levelM=0.1))),
            OceanModelPoint(-23.5,-43.0,0.494,listOf(OceanModelRow(now,eastMs=0.3,northMs=0.4))))
        compose.setContent { MaterialTheme { RjOceanTidesCurrentsPanel(data,now) } }
        compose.onNodeWithText("Maré astronômica prevista: -0,20 m").assertIsDisplayed()
        compose.onNodeWithText("Corrente total prevista: 0,50 m/s • rumo para 36,87 °").assertIsDisplayed()
    }
}
