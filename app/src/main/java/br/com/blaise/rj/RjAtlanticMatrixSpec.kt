package br.com.blaise.rj

/**
 * Blaise V6 RJ — Matriz Atlântico Integrado / 25 fenômenos.
 *
 * Static policy/metadata, NOT real-time observations or confirmed licenses.
 * Additional source providers are not empowered to issue P0 warnings.
 */
data class RjAtlanticPhenomenon(
    val number: Int,
    val title: String,
    val primaryPriority: String,
    val addedProviders: String,
    val addedSourceRole: String,
    val coverage: String,
    val liveStatus: String = "Integração adicional pendente de API, licença e dados verificados",
)

object RjAtlanticMatrixSpec {
    const val title = "Matriz Blaise V6 RJ — Atlântico Integrado | 25 Fenômenos"
    const val version = "11/10/2026 • 25 fenômenos centrais • 28 regras preservadas"
    const val openWeatherCredit = "Weather data provided by OpenWeather"
    const val secretPolicy = "Chave OpenWeather apenas no backend; nunca no APK"
    const val unavailableMessage = "Dados adicionais não confirmados em tempo real"

    private val titles = listOf(
        "Temperatura", "Sensação térmica", "Chuva atual e acumulada", "Previsão de chuva",
        "Temporais e tempestades", "Vento sustentado e direção", "Rajadas de vento",
        "Pressão atmosférica", "Umidade relativa", "Granizo", "Raios",
        "Ciclones e tempestades extratropicais", "Ondas", "Ressaca",
        "Marés e nível do mar", "Temperatura do mar", "Tsunami sísmico e meteorológico",
        "Nível e vazão dos rios", "Cheias, enchentes e inundações", "Deslizamentos",
        "Abalos sísmicos", "Alagamentos", "Trânsito e interdições",
        "Calor extremo e índice UV", "Qualidade do ar",
    )
    private val primaryPriority = listOf(
        "Alerta Rio (só Rio) → Defesa Civil → INMET",
        "Alerta Rio (só Rio) → Defesa Civil → INMET + cálculo Blaise",
        "Alerta Rio (só Rio) → Defesa Civil → INMET; CEMADEN hidrológico",
        "INMET → INPE/CPTEC → previsão oficial pertinente",
        "Alerta Rio (só Rio) → Defesa Civil → INMET; CEMADEN",
        "Alerta Rio (só Rio) → Defesa Civil → INMET",
        "Alerta Rio (só Rio) → Defesa Civil → INMET",
        "INMET → Marinha (litoral) → produtos oficiais",
        "Alerta Rio (só Rio) → Defesa Civil → INMET",
        "Alerta Rio (só Rio) → Defesa Civil → INMET; radar validado",
        "NOAA GLM → redes terrestres autorizadas",
        "Marinha do Brasil → INMET → NOAA / INPE",
        "Marinha/CHM → boias oficiais → NOAA",
        "Marinha/CHM → boias e avisos oficiais",
        "Marinha/CHM → marégrafos oficiais",
        "NOAA → boias e satélites oficiais",
        "NOAA + Marinha + autoridades brasileiras competentes",
        "ANA → SGB/SACE → redes hidrológicas oficiais",
        "Defesa Civil → SGB/SACE → CEMADEN → ANA",
        "Defesa Civil → Geo-Rio → CEMADEN",
        "USGS → rede sismológica oficial",
        "Defesa Civil → CEMADEN → ANA/SGB (onde pertinente)",
        "COR.Rio / CET-Rio → autoridades de trânsito e Defesa Civil",
        "Monitora RJ/SES → INMET → fontes de radiação/UV oficiais",
        "MonitorAr-Rio/SMAC → rede oficial de qualidade do ar",
    )
    private val europeanNotes = mapOf(
        11 to "EUMETSAT: raios de satélite se houver cobertura; Copernicus Marine: sem raios diretos.",
        12 to "Copernicus Marine: ondas/correntes/SST; EUMETSAT: nuvens/ventos satelitais.",
        13 to "Copernicus Marine: altura/período/direção das ondas; EUMETSAT: altimetria quando existente.",
        14 to "Copernicus Marine: estado do mar; EUMETSAT: vento/ondas. Aviso: Marinha.",
        15 to "Copernicus Marine: nível oceânico; EUMETSAT: altimetria. Maré local: CHM.",
        16 to "Copernicus Marine: temperatura superficial; EUMETSAT: observações satelitais.",
        22 to "Copernicus Marine: contexto costeiro; EUMETSAT: chuva/nuvens. Não mede rua alagada.",
        24 to "Copernicus Marine: calor oceânico; EUMETSAT: contexto atmosférico. Não substitui UV/saúde.",
    )
    val europeanNumbers = setOf(11,12,13,14,15,16,22,24)

    val rows: List<RjAtlanticPhenomenon> = titles.mapIndexed { i, name ->
        val number = i + 1
        when {
            number <= 10 -> RjAtlanticPhenomenon(
                number, name, primaryPriority[i], "OpenWeatherMap",
                "Dados agregados e previsões conforme produto contratado. Não confirma alerta oficial.",
                "92 municípios RJ conforme cobertura e coordenadas",
            )
            number in europeanNumbers -> RjAtlanticPhenomenon(
                number, name, primaryPriority[i], "Copernicus Marine • EUMETSAT",
                europeanNotes.getValue(number),
                if (number in setOf(11,12,13,14,15,16))
                    "Atlântico e litoral RJ; footprint real por produto"
                else "RJ: somente contexto geográfico pertinente, não estação local",
            )
            else -> RjAtlanticPhenomenon(
                number, name, primaryPriority[i], "Fontes especializadas já aprovadas",
                "Sem acréscimo das novas fontes para este fenômeno.",
                "Rio de Janeiro / litoral segundo a autoridade competente",
            )
        }
    }
    init {
        require(rows.size == 25 && primaryPriority.size == 25)
        require(rows.map { it.number } == (1..25).toList())
        require(rows.take(10).all { it.addedProviders == "OpenWeatherMap" })
        require(rows.filter { it.number in europeanNumbers }.all {
            it.addedProviders == "Copernicus Marine • EUMETSAT"
        })
    }
}
