package br.com.blaise.rj.admin

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import br.com.blaise.rj.BuildConfig
import br.com.blaise.rj.assistant.normalizedSpeech
import org.json.JSONObject

data class RjOwnerQuestion(val id: Int, val topic: String, val prompt: String)
data class RjOwnerQuestionBank(
    val goal: Int,
    val recovered: List<RjOwnerQuestion>,
    val slangVariantCount: Int,
    val verifiedStaticAnswers: Int
)

/**
 * The owner's archived prompts do not become fake current-weather answers.
 * Only the admin variant includes this asset. No server secrets reside here.
 */
object RjOwnerQuestionBankStore {
    private const val PATH = "blaise-rj-knowledge/question-bank-recovered-20261006.json"
    fun read(context: Context): RjOwnerQuestionBank? {
        if (!BuildConfig.BLAISE_ADMIN) return null
        return runCatching {
            val json = context.assets.open(PATH).bufferedReader(Charsets.UTF_8).use {
                JSONObject(it.readText())
            }
            require(json.getString("schema") == "BLAISE_RJ_OWNER_QUESTION_BANK_V1")
            val questions = json.getJSONArray("questions")
            val recovered = buildList {
                for (index in 0 until questions.length()) {
                    val row = questions.getJSONObject(index)
                    add(RjOwnerQuestion(
                        id = row.getInt("id"),
                        topic = row.getString("category"),
                        prompt = row.getString("question")
                    ))
                }
            }
            require(recovered.size == json.getInt("recoveredQuestionCount"))
            require(recovered.map { it.id }.distinct().size == recovered.size)
            RjOwnerQuestionBank(
                goal = json.getInt("declaredPlannedQuestionCount"),
                recovered = recovered,
                slangVariantCount = json.getJSONArray("colloquialVariants").length(),
                verifiedStaticAnswers = json.getInt("recoveredVerifiedAnswerCount")
            )
        }.getOrNull()
    }
}

@Composable
fun RjOwnerQuestionBankPanel() {
    if (!BuildConfig.BLAISE_ADMIN) return
    val context = LocalContext.current
    val bank = remember(context) { RjOwnerQuestionBankStore.read(context) }
    var expanded by remember { mutableStateOf(false) }
    var search by remember { mutableStateOf("") }
    Card(Modifier.fillMaxWidth().testTag("rj-admin-questions-panel")) {
        Column(
            Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp)
        ) {
            Text("CATÁLOGO ADMINISTRATIVO • 800 PERGUNTAS PREVISTAS")
            if (bank == null) {
                Text("Arquivo protegido não disponível neste build. Não há comprovação de 800 perguntas importadas.")
            } else {
                Text("${bank.recovered.size} perguntas recuperadas • " +
                    "${bank.slangVariantCount} variações de linguagem • " +
                    "${bank.goal - bank.recovered.size} cenários adicionais para pesquisa dinâmica (conexão online pendente)")
                Text("Respostas estáticas revisadas: ${bank.verifiedStaticAnswers}. " +
                    "As respostas de tempo real dependem de consulta oficial recente.")
                OutlinedButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { expanded = true }
                ) { Text("Consultar perguntas recuperadas") }
            }
        }
    }
    if (expanded && bank != null) {
        val filtered = remember(search, bank) {
            bank.recovered.filter {
                val needle = normalizedSpeech(search)
                needle.isBlank() || normalizedSpeech(it.prompt).contains(needle) ||
                    normalizedSpeech(it.topic).contains(needle)
            }
        }
        AlertDialog(
            onDismissRequest = { expanded = false },
            title = { Text("Banco de perguntas da administração") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    OutlinedTextField(
                        value = search, onValueChange = { search = it.take(90) },
                        label = { Text("Buscar pergunta ou assunto") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text("${filtered.size} perguntas encontradas. " +
                        "Dados atuais nunca são respostas fixas armazenadas.")
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 430.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(filtered, key = { it.id }) { entry ->
                            Text("${entry.id}. ${entry.prompt}")
                            Text(entry.topic)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { expanded = false }) { Text("Fechar") }
            }
        )
    }
}
