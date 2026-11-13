package br.com.blaise.rj

import br.com.blaise.rj.data.StatewideSnapshot
import br.com.blaise.rj.data.StatewideSource

/**
 * Approved source catalog for the ORIGINAL Blaise V6 RJ Compose interface.
 *
 * Catalog membership is a product decision, NOT evidence of a live connection.
 * Dynamic connection labels come only from a fresh, worker-active backend
 * snapshot; source-level time/quality/municipality still need verification.
 */
data class RjSourceEntry(
    val id: String,
    val name: String,
    val purpose: String,
    val backendSourceIds: Set<String> = emptySet(),
)

object RjSourceCatalog {
    val meteorological: List<RjSourceEntry> = listOf(
        RjSourceEntry("alerta-rio-cor", "Alerta Rio / COR.Rio", "Chuva, radar Sumaré e ocorrências na capital", setOf("alerta-rio", "cor-cet")),
        RjSourceEntry("defesa-civil", "Defesa Civil RJ", "Avisos oficiais, emergências e proteção da população", setOf("defesa-civil")),
        RjSourceEntry("inmet", "INMET", "Estações meteorológicas, avisos, vento, umidade e pressão", setOf("inmet")),
        RjSourceEntry("inpe-cptec", "INPE / CPTEC", "Previsões, frentes, tempestades e produtos oceânicos"),
        RjSourceEntry("cemaden", "CEMADEN", "Chuva e risco hidrológico/geológico", setOf("cemaden-rj")),
        RjSourceEntry("noaa", "NOAA", "Modelos, ondas, swell e produtos oceânicos", setOf("noaa")),
        RjSourceEntry("eumetsat", "EUMETSAT", "Observações por satélite, nuvens, vento e temperatura do mar"),
        RjSourceEntry("jaxa", "JAXA / GSMaP", "Estimativas de precipitação por satélite"),
    )

    val complementary: List<RjSourceEntry> = listOf(
        RjSourceEntry("cet-geo", "CET-Rio / Geo-Rio", "Trânsito, interdições, encostas e riscos urbanos", setOf("cor-cet")),
        RjSourceEntry("usgs", "USGS", "Sismos e dados sísmicos", setOf("usgs")),
        RjSourceEntry("ana", "ANA / Hidroweb", "Hidrologia, quando houver produto autorizado", setOf("ana")),
        RjSourceEntry("sgb", "SGB / SACE", "Monitoramento hidrológico complementar", setOf("sgb-sace")),
    )

    // These are OPTIONAL visualization/forecast complements, NOT primary
    // meteorological or official alert authorities. No live status is claimed.
    val optionalComplements: List<RjSourceEntry> = listOf(
        RjSourceEntry("weather", "Weather.com", "Previsão horária, condicionada a licença e validação"),
        RjSourceEntry("earth", "Earth Nullschool", "Visualização complementar, condicionada a permissão"),
    )

    private val allowedBackendIds = (meteorological + complementary)
        .flatMap { it.backendSourceIds }
        .toSet()

    /** Exclusion is checked before rendering potentially untrusted source names. */
    private val blockedTokens = listOf("inea", "marinha", "chm", "windy", "copernicus")

    /** Marine reading labels must match an approved authority, not a legacy cache. */
    fun mayShowMarineSource(name: String): Boolean {
        val value = name.trim().lowercase(java.util.Locale.ROOT)
        if (value.isEmpty() || blockedTokens.any { it in value }) return false
        return value in setOf(
            "noaa", "noaa gfs-wave", "noaa gfs wave", "inpe / cptec", "inpe/cptec",
            "cptec/inpe", "inmet", "eumetsat", "jaxa / gsmap", "jaxa/gsmap",
            "jaxa gsmap", "defesa civil rj", "cemaden", "alerta rio"
        )
    }

    fun mayShowBackendSource(source: StatewideSource): Boolean {
        val text = listOf(source.id, source.name, source.connectedProduct.orEmpty())
            .joinToString(" ").lowercase(java.util.Locale.ROOT)
        return source.id in allowedBackendIds && blockedTokens.none { it in text }
    }

    /** Never label catalog-only registrations as connected or live. */
    fun connectionLabel(entry: RjSourceEntry, snapshot: StatewideSnapshot?): String {
        if (snapshot == null || !snapshot.workerActive) return "Conexão em tempo real não comprovada"
        val matched = snapshot.sources.filter {
            it.id in entry.backendSourceIds && mayShowBackendSource(it)
        }
        if (matched.isEmpty()) return "Integração não comprovada neste painel"
        if (matched.any { it.state in setOf("CURRENT", "CURRENT_DEGRADED") && !it.connectedProduct.isNullOrBlank() }) {
            return "Produto reportado pelo backend; validar horário, qualidade e local"
        }
        if (matched.any { it.state == "STALE" }) return "Produto desatualizado"
        return "Produto sem medição atual validada"
    }
}
