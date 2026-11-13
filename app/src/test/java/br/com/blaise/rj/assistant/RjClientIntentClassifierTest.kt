package br.com.blaise.rj.assistant

import org.junit.Assert.*
import org.junit.Test

class RjClientIntentClassifierTest {
    @Test fun multipleMeteorologicalTopicsAreIdentifiedWithoutStaticWeatherAnswers() {
        val result = RjClientIntentClassifier.identify(
            "Qual a sensação térmica, vento e chuva em Niterói amanhã?"
        )
        assertTrue(result.recognized)
        assertTrue("temperatura e sensação térmica" in result.topics)
        assertTrue("vento" in result.topics)
        assertTrue("chuva" in result.topics)
        assertTrue("previsão meteorológica" in result.topics)
        assertTrue(result.requiresLiveEvidence)
    }

    @Test fun recognizesRadarMarineUvAviationAndLocalSlang() {
        for (phrase in listOf(
            "Radar Sumaré ao vivo", "Ressaca e swell em Cabo Frio",
            "Índice UV em Niterói", "Quais os atrasos de voo no aeroporto?",
            "Hoje tá um bafo de frito na Zona Oeste",
            "A maré está alta e há risco de tsunami no litoral?"
        )) assertTrue("Not recognized: $phrase",
            RjClientIntentClassifier.identify(phrase).recognized)
    }

    @Test fun answersNeverEmbedRawNumbersSourcesOrGuessedLiveWeather() {
        val unknown = RjClientIntentClassifier.identify("tsunami na costa")
            .unavailableExplanation("Cabo Frio")
        assertTrue(unknown.contains("Cabo Frio"))
        assertTrue(unknown.contains("fonte atual"))
        assertFalse(unknown.contains("sem risco"))
    }

    @Test fun noIntentForUnrelatedUserText() {
        assertFalse(RjClientIntentClassifier.identify("bom dia, tudo certo?").recognized)
    }
}
