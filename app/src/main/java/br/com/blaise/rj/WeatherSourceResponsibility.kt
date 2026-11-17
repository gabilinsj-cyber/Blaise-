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
            "Temperatura, umidade, pressão, vento, nuvens, chuva prevista", "P/E",
            "ECMWF_IFS", true),
        WeatherSourceResponsibility("NOAA_GFS_ATMOS", "NOAA GFS",
            "Comparação de temperatura, chuva, vento e sistemas", "P", "NOAA_GFS", false),
        WeatherSourceResponsibility("DWD_ICON", "DWD ICON Global • Alemanha",
            "Temperatura do ar a 2 m PREVISTA para o RJ, vento, pressão e chuva futura. Modelo alemão, não estação física local.",
            "P", "DWD_ICON", false),
        WeatherSourceResponsibility("OPENWEATHER_AGENT13", "OpenWeather One Call 4.0 • Agente 13",
            "Contingência somente de temperatura e sensação térmica estimadas quando DWD, NOAA e ECMWF estiverem indisponíveis.",
            "E", "OPENWEATHER_MODELED_CURRENT", false),
        WeatherSourceResponsibility("METEOBLUE_NEMS10", "meteoblue • NEMS10 / MultiModel",
            "Comparação de previsões de temperatura, vento, chuva futura e nuvens; API comercial não homologada.",
            "P", "METEOBLUE_NEMS10", false),
        WeatherSourceResponsibility("NOAA_GFS_WAVE", "NOAA GFS-Wave",
            "Altura de ondas no oceano", "P", "NOAA_GFS_WAVE", true),
        WeatherSourceResponsibility("ECMWF_WAVE", "ECMWF Waves",
            "Comparação de ondas e swell", "P", "ECMWF_WAVE", false),
        WeatherSourceResponsibility("RAMMB_CIRA_SLIDER", "RAMMB/CIRA SLIDER • GOES-19",
            "Imagens externas de nuvens, frentes e sistemas sobre RJ e Atlântico. Não mede chuva em mm.",
            "O", "GOES_EAST", false),
        WeatherSourceResponsibility("EUMETSAT_OSI_SAF", "EUMETSAT OSI SAF",
            "Temperatura estimada da superfície do mar", "E", "GOES_EAST_ABI", false),
        WeatherSourceResponsibility("NOAA_COASTWATCH", "NOAA CoastWatch",
            "Temperatura da superfície do mar • sensor GOES correlacionado", "E",
            "GOES_EAST_ABI", false),
        WeatherSourceResponsibility("NOAA_GLM", "NOAA GOES / GLM",
            "Descargas elétricas vistas por satélite", "O", "GOES_EAST_GLM", false),
        WeatherSourceResponsibility("CAMS_UV_VIA_MET", "CAMS UV via MET Norway",
            "UV previsto em céu limpo, não UV observado", "P", "CAMS", true),
    )
    init {
        require(providers.size == 12)
        require(providers.map { it.id }.distinct().size == providers.size)
        require(providers.all { it.nature.all { c -> c in "OEP/" } })
        require(providers.none {
            it.id.contains("INEA") || it.id.contains("MARINHA") ||
                it.id.contains("JAXA") || it.id.contains("NASA_IMERG")
        })
    }

    fun availability(
        id: String, hasValidatedMet: Boolean, hasValidatedNoaaWave: Boolean,
        hasClearSkyUv: Boolean
    ): String = when (id) {
        "RAMMB_CIRA_SLIDER" -> "CONSULTA VISUAL EXTERNA • SEM COLETA NUMÉRICA"
        "OPENWEATHER_AGENT13" -> "CONTINGÊNCIA TÉRMICA CONDICIONAL • NÃO É ALERTA OFICIAL"
        "METEOBLUE_NEMS10" -> "PREVISÃO CANDIDATA • API E LICENÇA NÃO HOMOLOGADAS"
        "MET_NO_ECMWF" -> if (hasValidatedMet) "PREVISÃO VALIDADA NO BACKEND" else "SEM PREVISÃO VÁLIDA RECEBIDA"
        "NOAA_GFS_WAVE" -> if (hasValidatedNoaaWave) "MODELO MARÍTIMO VALIDADO" else "SEM PREVISÃO VÁLIDA RECEBIDA"
        "CAMS_UV_VIA_MET" -> if (hasClearSkyUv) "PREVISÃO DE CÉU LIMPO VALIDADA" else "SEM DADO VÁLIDO RECEBIDO"
        else -> "COLETA DO PRODUTO NÃO HOMOLOGADA"
    }
}
