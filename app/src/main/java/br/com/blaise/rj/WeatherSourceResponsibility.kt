package br.com.blaise.rj

/** Customer-readable source roles. These are not live connection claims.
 * Only signed backend snapshots with proper provenance determine availability.
 */
data class WeatherSourceResponsibility(
    val id: String, val label: String, val sectors: String, val nature: String,
    val originFamily: String, val currentlyIntegratedProduct: Boolean,
)

object WeatherSourceResponsibilities {
    val providers = listOf(
        WeatherSourceResponsibility("MET_NO_ECMWF", "MET Norway / ECMWF IFS",
            "Umidade, pressão, vento, nuvens e chuva prevista; SEM temperatura ou sensação térmica", "P/E",
            "ECMWF_IFS", true),
        WeatherSourceResponsibility("NOAA_GFS_ATMOS", "NOAA GFS",
            "Chuva, vento e sistemas; EXCLUÍDO de temperatura e sensação térmica", "P", "NOAA_GFS", false),
        WeatherSourceResponsibility("DWD_ICON", "DWD ICON Global • Alemanha",
            "Temperatura do ar a 2 m PREVISTA para o RJ, vento, pressão e chuva futura. Modelo alemão, não estação física local.",
            "P", "DWD_ICON", false),
        WeatherSourceResponsibility("OPENWEATHER_AGENT13", "OpenWeather One Call 4.0",
            "Temperatura e sensação térmica estimadas, com quota e validação; NOAA e ECMWF não são termômetros prioritários.",
            "E", "OPENWEATHER_MODELED_CURRENT", false),
        WeatherSourceResponsibility("HG_BRASIL_WEATHER_PRO", "HG Brasil Weather",
            "Temperatura atual agregada (E); autorização comercial escrita recebida, mas plano Pro ainda não contratado. Origem individual das estações não é informada.",
            "E", "HG_BRASIL_AGGREGATED", false),
        WeatherSourceResponsibility("METEOBLUE_FREE_FORECAST", "meteoblue Free • mLM 6h",
            "Uma resposta REAL privada com 7/7 campos basic-6h validada em 19/11/2026: chuva prevista e convectiva, probabilidade, vento médio/máximo, umidade e pressão. NÃO mede chuva atual, rajadas, temperatura nem sensação. Valores não homologados para clientes; máximo 1 consulta/dia UTC.",
            "P", "METEOBLUE_MLM", false),
        WeatherSourceResponsibility("VISUAL_CROSSING_FREE", "Visual Crossing Free",
            "Uma consulta REAL privada validou temperatura, sensação, umidade, orvalho, vento, probabilidade de chuva e pressão (E), e 36 horários futuros (P). Sem medição por estação; cache não foi salvo no teste; coleta de 92 municípios e publicação continuam desligadas.",
            "E/P", "VISUAL_CROSSING_FREE", false),
        WeatherSourceResponsibility("NOAA_GFS_WAVE", "NOAA GFS-Wave",
            "Altura de ondas no oceano", "P", "NOAA_GFS_WAVE", true),
        WeatherSourceResponsibility("ECMWF_WAVE", "ECMWF Waves",
            "Comparação de ondas e swell", "P", "ECMWF_WAVE", false),
        WeatherSourceResponsibility("RAMMB_CIRA_SLIDER", "RAMMB/CIRA SLIDER • GOES-19",
            "Imagens externas de nuvens, frentes e sistemas sobre RJ e Atlântico. Não mede chuva em mm.",
            "O", "GOES_EAST", false),
        WeatherSourceResponsibility("NOAA_COASTWATCH_SST", "NOAA CoastWatch / GOES-19",
            "Temperatura estimada da superfície do mar • somente pixel validado; não é temperatura do ar", "E",
            "GOES_EAST_ABI", false),
        WeatherSourceResponsibility("NOAA_GLM", "NOAA GOES / GLM",
            "Descargas elétricas vistas por satélite", "O", "GOES_EAST_GLM", false),
        WeatherSourceResponsibility("CAMS_UV_VIA_MET", "CAMS UV via MET Norway",
            "UV previsto em céu limpo, não UV observado", "P", "CAMS", true),
    )
    init {
        require(providers.size == 13)
        require(providers.map { it.id }.distinct().size == providers.size)
        require(providers.all { it.nature.all { c -> c in "OEP/" } })
        require(providers.none {
            it.id.contains("INEA") || it.id.contains("MARINHA") ||
                it.id.contains("JAXA") || it.id.contains("NASA_IMERG") ||
                it.id.contains("EUMETSAT")
        })
    }

    fun availability(
        id: String, hasValidatedMet: Boolean, hasValidatedNoaaWave: Boolean,
        hasClearSkyUv: Boolean
    ): String = when (id) {
        "RAMMB_CIRA_SLIDER" -> "CONSULTA VISUAL EXTERNA • SEM COLETA NUMÉRICA"
        "OPENWEATHER_AGENT13" -> "CONTINGÊNCIA TÉRMICA CONDICIONAL • NÃO É ALERTA OFICIAL"
        "METEOBLUE_FREE_FORECAST" -> "1 RESPOSTA REAL PRIVADA • 7/7 CAMPOS • NÃO HOMOLOGADA • SEM PUBLICAÇÃO"
        "VISUAL_CROSSING_FREE" -> "1 RESPOSTA REAL PRIVADA • 7/10 CAMPOS ATUAIS • SEM CACHE • SEM PUBLICAÇÃO"
        "HG_BRASIL_WEATHER_PRO" -> "AUTORIZAÇÃO COMERCIAL RECEBIDA • ASSINATURA ADIADA • SEM COLETA"
        "MET_NO_ECMWF" -> if (hasValidatedMet) "PREVISÃO VALIDADA NO BACKEND" else "SEM PREVISÃO VÁLIDA RECEBIDA"
        "NOAA_GFS_WAVE" -> if (hasValidatedNoaaWave) "MODELO MARÍTIMO VALIDADO" else "SEM PREVISÃO VÁLIDA RECEBIDA"
        "CAMS_UV_VIA_MET" -> if (hasClearSkyUv) "PREVISÃO DE CÉU LIMPO VALIDADA" else "SEM DADO VÁLIDO RECEBIDO"
        else -> "COLETA DO PRODUTO NÃO HOMOLOGADA"
    }
}
