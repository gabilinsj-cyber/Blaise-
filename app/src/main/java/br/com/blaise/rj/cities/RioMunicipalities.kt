package br.com.blaise.rj.cities

import br.com.blaise.rj.core.City
import java.text.Normalizer

object RioMunicipalities {
    val all: List<City> = listOf(
        City("Angra dos Reis", 3300100),
        City("Aperibé", 3300159),
        City("Araruama", 3300209),
        City("Areal", 3300225),
        City("Armação dos Búzios", 3300233),
        City("Arraial do Cabo", 3300258),
        City("Barra do Piraí", 3300308),
        City("Barra Mansa", 3300407),
        City("Belford Roxo", 3300456),
        City("Bom Jardim", 3300506),
        City("Bom Jesus do Itabapoana", 3300605),
        City("Cabo Frio", 3300704),
        City("Cachoeiras de Macacu", 3300803),
        City("Cambuci", 3300902),
        City("Campos dos Goytacazes", 3301009),
        City("Cantagalo", 3301108),
        City("Carapebus", 3300936),
        City("Cardoso Moreira", 3301157),
        City("Carmo", 3301207),
        City("Casimiro de Abreu", 3301306),
        City("Comendador Levy Gasparian", 3300951),
        City("Conceição de Macabu", 3301405),
        City("Cordeiro", 3301504),
        City("Duas Barras", 3301603),
        City("Duque de Caxias", 3301702),
        City("Engenheiro Paulo de Frontin", 3301801),
        City("Guapimirim", 3301850),
        City("Iguaba Grande", 3301876),
        City("Itaboraí", 3301900),
        City("Itaguaí", 3302007),
        City("Italva", 3302056),
        City("Itaocara", 3302106),
        City("Itaperuna", 3302205),
        City("Itatiaia", 3302254),
        City("Japeri", 3302270),
        City("Laje do Muriaé", 3302304),
        City("Macaé", 3302403),
        City("Macuco", 3302452),
        City("Magé", 3302502),
        City("Mangaratiba", 3302601),
        City("Maricá", 3302700),
        City("Mendes", 3302809),
        City("Mesquita", 3302858),
        City("Miguel Pereira", 3302908),
        City("Miracema", 3303005),
        City("Natividade", 3303104),
        City("Nilópolis", 3303203),
        City("Niterói", 3303302),
        City("Nova Friburgo", 3303401),
        City("Nova Iguaçu", 3303500),
        City("Paracambi", 3303609),
        City("Paraíba do Sul", 3303708),
        City("Paraty", 3303807),
        City("Paty do Alferes", 3303856),
        City("Petrópolis", 3303906),
        City("Pinheiral", 3303955),
        City("Piraí", 3304003),
        City("Porciúncula", 3304102),
        City("Porto Real", 3304110),
        City("Quatis", 3304128),
        City("Queimados", 3304144),
        City("Quissamã", 3304151),
        City("Resende", 3304201),
        City("Rio Bonito", 3304300),
        City("Rio Claro", 3304409),
        City("Rio das Flores", 3304508),
        City("Rio das Ostras", 3304524),
        City("Rio de Janeiro", 3304557),
        City("Santa Maria Madalena", 3304607),
        City("Santo Antônio de Pádua", 3304706),
        City("São Fidélis", 3304805),
        City("São Francisco de Itabapoana", 3304755),
        City("São Gonçalo", 3304904),
        City("São João da Barra", 3305000),
        City("São João de Meriti", 3305109),
        City("São José de Ubá", 3305133),
        City("São José do Vale do Rio Preto", 3305158),
        City("São Pedro da Aldeia", 3305208),
        City("São Sebastião do Alto", 3305307),
        City("Sapucaia", 3305406),
        City("Saquarema", 3305505),
        City("Seropédica", 3305554),
        City("Silva Jardim", 3305604),
        City("Sumidouro", 3305703),
        City("Tanguá", 3305752),
        City("Teresópolis", 3305802),
        City("Trajano de Moraes", 3305901),
        City("Três Rios", 3306008),
        City("Valença", 3306107),
        City("Varre-Sai", 3306156),
        City("Vassouras", 3306206),
        City("Volta Redonda", 3306305),
    )

    private val byCode = all.associateBy(City::ibgeCode)
    private val byName = all.associateBy(City::name)

    init {
        require(all.size == 92) { "RJ must contain exactly 92 municipalities" }
        require(byCode.size == all.size) { "IBGE municipality codes must be unique" }
        require(byName.size == all.size) { "Municipality names must be unique" }
    }

    fun byIbgeCode(code: Int): City? = byCode[code]
    fun byName(name: String): City? = byName[name]

    fun search(query: String): List<City> {
        val normalizedQuery = normalize(query.trim())
        if (normalizedQuery.isEmpty()) return all
        return all.filter { normalize(it.name).contains(normalizedQuery) }
    }

    private fun normalize(value: String): String =
        Normalizer.normalize(value, Normalizer.Form.NFD)
            .replace("\\p{Mn}+".toRegex(), "")
            .lowercase()
}
